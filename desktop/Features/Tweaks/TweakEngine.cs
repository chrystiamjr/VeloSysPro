using System;
using System.Collections.Generic;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>Before/after Optimization Snapshots taken around one batch.</summary>
    public sealed record SnapshotDiff(OptimizationSnapshot Before, OptimizationSnapshot After);

    /// <summary>
    /// Outcome of a batch: whether every Tweak applied, the settings it actually changed, and the
    /// system metrics either side of it.
    /// </summary>
    /// <remarks>
    /// <paramref name="Changes"/> and <paramref name="Diff"/> answer different questions and must
    /// not be conflated in the UI. The changes are fully attributable to the Tweaks; the metrics
    /// move for reasons of their own and some of them cannot move until the machine reboots.
    /// </remarks>
    public sealed record TweakBatchResult(
        bool Ok,
        SnapshotDiff? Diff,
        IReadOnlyList<TweakChange> Changes
    );

    /// <summary>
    /// Orchestrates a batch of Tweaks: Safety Checkpoint, per-Tweak capture, apply, and the
    /// before/after measurement — plus the single-Tweak Revert that the capture makes possible.
    /// </summary>
    /// <remarks>
    /// The engine never emits IPC Events itself. It returns facts and lets <see cref="ActionHost"/>
    /// publish them, which keeps the Actions-in/Events-out seam in one place (ARCHITECTURE.md).
    /// </remarks>
    public sealed class TweakEngine
    {
        /// <summary>Serializable shape matching the Tweak interface in the React frontend.</summary>
        private record TweakInfo(
            string Id,
            string Category,
            string RiskTier,
            string Kind,
            string State,
            bool Recommended,
            bool RequiresReboot
        );

        private record PresetInfo(string Id, IReadOnlyList<string> TweakIds);

        private record CatalogInfo(
            IReadOnlyList<TweakInfo> Tweaks,
            IReadOnlyList<PresetInfo> Presets,
            bool SystemProtectionEnabled
        );

        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        private readonly TweakCatalog _catalog;
        private readonly ITweakCaptureStore _captures;
        private readonly SystemRestoreManager _systemRestore;
        private readonly SafetyCheckpoint _safety;
        private readonly SnapshotManager _snapshots;
        private readonly ISnapshotStore _history;
        private readonly IStatusSink _sink;

        /// <summary>Mirrors <see cref="Optimizer.CreateSafetyBackupEnabled"/>: the same preference.</summary>
        public bool CreateSafetyBackupEnabled
        {
            get => _safety.Enabled;
            set => _safety.Enabled = value;
        }

        public TweakEngine(
            TweakCatalog catalog,
            ITweakCaptureStore captures,
            SystemRestoreManager systemRestore,
            SafetyCheckpoint safety,
            SnapshotManager snapshots,
            ISnapshotStore history,
            IStatusSink sink
        )
        {
            _catalog = catalog;
            _captures = captures;
            _systemRestore = systemRestore;
            _safety = safety;
            _snapshots = snapshots;
            _history = history;
            _sink = sink;
        }

        public TweakEngine(
            TweakCatalog catalog,
            ITweakCaptureStore captures,
            SystemRestoreManager systemRestore,
            SnapshotManager snapshots,
            ISnapshotStore history,
            IStatusSink sink
        )
            : this(
                catalog,
                captures,
                systemRestore,
                new SafetyCheckpoint(systemRestore, new RegistryBackupManager(AppPaths.Backups, new CommandRunner(sink), sink), sink),
                snapshots,
                history,
                sink
            )
        {
        }

        /// <summary>
        /// The engine as the app ships it, so the window and the headless CLI compose the same one.
        /// </summary>
        public static TweakEngine CreateDefault(
            ICommandRunner cmd,
            RegistryBackupManager backup,
            SystemRestoreManager systemRestore,
            IStatusSink sink
        )
        {
            var safety = new SafetyCheckpoint(systemRestore, backup, sink);
            return new TweakEngine(
                TweakCatalog.CreateDefault(cmd, backup),
                new JsonTweakCaptureStore(),
                systemRestore,
                safety,
                new SnapshotManager(cmd, sink),
                new JsonlSnapshotStore(),
                sink
            );
        }

        /// <summary>
        /// True when the catalog defines a Preset with this id.
        /// </summary>
        /// <remarks>
        /// Asked separately from running it so the headless CLI can tell "no such task" from "the
        /// task ran and failed". Folding both into one bool made a failed batch report itself as an
        /// unknown task name.
        /// </remarks>
        public bool HasPreset(string presetId) => FindPreset(presetId) != null;

        /// <summary>
        /// Applies every Tweak in a Preset — the headless CLI's way into the à-la-carte catalog.
        /// </summary>
        /// <remarks>
        /// Applies the Preset's whole selection rather than the difference against the live system,
        /// because a scheduled run has no user drawing an intent. A Tweak already in place is a
        /// no-op its own <see cref="ITweak.Apply"/> absorbs.
        /// </remarks>
        public bool ApplyPreset(string presetId)
        {
            Preset? preset = FindPreset(presetId);
            if (preset == null)
            {
                _sink.Log("log.tweaks.unknownPreset", "error", new { id = presetId });
                return false;
            }

            return ApplyTweaks(preset.TweakIds).Ok;
        }

        private Preset? FindPreset(string presetId)
        {
            foreach (Preset preset in _catalog.Presets)
            {
                if (string.Equals(preset.Id, presetId, StringComparison.OrdinalIgnoreCase))
                    return preset;
            }
            return null;
        }

        /// <summary>The catalog with each Tweak's live state, as the tweaksLoaded payload.</summary>
        public string GetTweaksJson()
        {
            var tweaks = new List<TweakInfo>(_catalog.Tweaks.Count);
            foreach (ITweak tweak in _catalog.Tweaks)
            {
                tweaks.Add(
                    new TweakInfo(
                        tweak.Id,
                        tweak.Category,
                        tweak.RiskTier.ToString(),
                        tweak.Kind,
                        tweak.Detect().ToString(),
                        _catalog.Recommended.Contains(tweak.Id),
                        tweak.RequiresReboot
                    )
                );
            }

            var presets = new List<PresetInfo>(_catalog.Presets.Count);
            foreach (Preset preset in _catalog.Presets)
                presets.Add(new PresetInfo(preset.Id, preset.TweakIds));

            // Travels with the catalog so the screen can warn about the missing safety net before
            // the user selects anything, rather than after a batch has already failed.
            return JsonSerializer.Serialize(
                new CatalogInfo(tweaks, presets, _systemRestore.IsProtectionEnabled()),
                Options
            );
        }

        /// <summary>Turns Windows System Protection on so batches can build a Safety Checkpoint.</summary>
        public bool EnableSystemProtection()
        {
            try
            {
                _systemRestore.EnableProtection();
                return true;
            }
            catch (Exception ex)
            {
                _sink.Log("log.protection.failed", "error", new { message = ex.Message });
                return false;
            }
        }

        /// <summary>
        /// Puts the selected Tweaks into the state the user asked for, behind one Safety Checkpoint,
        /// measuring the system before and after. An unknown id fails the whole batch rather than
        /// silently acting on a subset.
        /// </summary>
        /// <remarks>
        /// Applying and reverting travel together because the screen expresses a desired state, not
        /// a queue of commands: unticking one Tweak and ticking another is a single intention, and
        /// splitting it into two batches would mean two restore points and two measurements around
        /// halves of one change. Reverts run first so the batch ends in the state the user drew,
        /// whatever order they clicked in.
        /// </remarks>
        public TweakBatchResult ApplyTweaks(
            IReadOnlyList<string> applyIds,
            IReadOnlyList<string>? revertIds = null
        )
        {
            IReadOnlyList<string> toRevert = revertIds ?? Array.Empty<string>();
            var noChanges = Array.Empty<TweakChange>();

            if (applyIds.Count == 0 && toRevert.Count == 0)
            {
                _sink.Log("log.tweaks.noneSelected", "error");
                return new TweakBatchResult(false, null, noChanges);
            }

            if (!Resolve(applyIds, out List<ITweak> toApplyTweaks)
                || !Resolve(toRevert, out List<ITweak> toRevertTweaks))
            {
                return new TweakBatchResult(false, null, noChanges);
            }

            _sink.Status("status.tweaks.measuring", 10);
            OptimizationSnapshot before = CaptureSnapshot();

            if (!BuildCheckpoint()) return new TweakBatchResult(false, null, noChanges);

            bool ok = true;
            var changes = new List<TweakChange>();
            int total = toApplyTweaks.Count + toRevertTweaks.Count;
            int done = 0;

            foreach (ITweak tweak in toRevertTweaks)
            {
                _sink.Status("status.tweaks.reverting", 40 + (40 * done++ / total), new { id = tweak.Id });

                TweakCapture? capture = _captures.LoadLatest(tweak.Id);
                if (capture == null)
                {
                    _sink.Log("log.tweaks.noCapture", "error", new { id = tweak.Id });
                    ok = false;
                    continue;
                }

                if (tweak.Revert(capture))
                {
                    _sink.Log("log.tweaks.reverted", "success", new { id = tweak.Id });
                }
                else
                {
                    _sink.Log("log.tweaks.revertFailed", "error", new { id = tweak.Id });
                    ok = false;
                }

                changes.AddRange(DescribeChange(tweak, capture));
            }

            foreach (ITweak tweak in toApplyTweaks)
            {
                _sink.Status("status.tweaks.applying", 40 + (40 * done++ / total), new { id = tweak.Id });

                TweakCapture capture = tweak.Capture();
                _captures.Save(capture);

                if (tweak.Apply(capture))
                {
                    _sink.Log("log.tweaks.applied", "success", new { id = tweak.Id });
                }
                else
                {
                    _sink.Log("log.tweaks.applyFailed", "error", new { id = tweak.Id });
                    ok = false;
                }

                changes.AddRange(DescribeChange(tweak, capture));
            }

            _sink.Status("status.tweaks.measuring", 90);
            OptimizationSnapshot after = CaptureSnapshot();

            _sink.Status("status.tweaks.done", 100);
            _sink.Log(ok ? "log.tweaks.done" : "log.op.completedWithErrors", ok ? "success" : "error");

            return new TweakBatchResult(ok, new SnapshotDiff(before, after), changes);
        }

        private bool Resolve(IReadOnlyList<string> ids, out List<ITweak> resolved)
        {
            resolved = new List<ITweak>(ids.Count);
            foreach (string id in ids)
            {
                ITweak? tweak = _catalog.Find(id);
                if (tweak == null)
                {
                    _sink.Log("log.tweaks.unknown", "error", new { id });
                    return false;
                }
                resolved.Add(tweak);
            }
            return true;
        }

        /// <summary>
        /// Re-reads a Tweak after applying it and reports only the settings that really moved.
        /// </summary>
        /// <remarks>
        /// Reading back rather than reporting the catalog's intended value is the whole point: a
        /// write that silently did nothing shows up here as "no change" instead of as a success.
        /// </remarks>
        private static IEnumerable<TweakChange> DescribeChange(ITweak tweak, TweakCapture before)
        {
            IReadOnlyList<CapturedValue> after = tweak.ReadCurrentValues();

            foreach (CapturedValue current in after)
            {
                CapturedValue? prior = null;
                foreach (CapturedValue candidate in before.Values)
                {
                    if (string.Equals(candidate.Name, current.Name, StringComparison.OrdinalIgnoreCase))
                    {
                        prior = candidate;
                        break;
                    }
                }

                string priorData = prior is { Existed: true } ? prior.Data : "";
                string currentData = current.Existed ? current.Data : "";
                if (string.Equals(priorData, currentData, StringComparison.Ordinal)) continue;

                yield return new TweakChange(tweak.Id, current.Name, priorData, currentData);
            }
        }

        /// <summary>Restores one Tweak from its latest capture, without a reboot.</summary>
        public bool RevertTweak(string id)
        {
            ITweak? tweak = _catalog.Find(id);
            if (tweak == null)
            {
                _sink.Log("log.tweaks.unknown", "error", new { id });
                return false;
            }

            TweakCapture? capture = _captures.LoadLatest(id);
            if (capture == null)
            {
                // Without a capture there is no prior state to restore, and inventing one could
                // leave the system in a worse place than the Tweak did.
                _sink.Log("log.tweaks.noCapture", "error", new { id });
                return false;
            }

            _sink.Status("status.tweaks.reverting", 50, new { id });
            bool ok = tweak.Revert(capture);
            _sink.Status("status.tweaks.done", 100);
            _sink.Log(ok ? "log.tweaks.reverted" : "log.tweaks.revertFailed", ok ? "success" : "error", new { id });
            return ok;
        }

        /// <summary>Captures a Snapshot and appends it to the Optimization History.</summary>
        public OptimizationSnapshot CaptureSnapshot()
        {
            OptimizationSnapshot snapshot = _snapshots.Capture();
            try
            {
                _history.Append(snapshot);
            }
            catch (Exception ex)
            {
                // Losing a history row must not fail an optimization the user asked for.
                _sink.LogRaw("Failed to persist the Optimization Snapshot: " + ex.Message, "error");
            }
            return snapshot;
        }

        public IReadOnlyList<OptimizationSnapshot> LoadHistory() => _history.ReadAll();

        /// <summary>
        /// The "big undo" half of a Safety Checkpoint. A failed restore point stops the batch: the
        /// user asked for an optimization with a safety net, and proceeding without one silently
        /// would not be the thing they asked for.
        /// </summary>
        private bool BuildCheckpoint()
        {
            return _safety.ExecuteTweakCheckpoint();
        }
    }
}
