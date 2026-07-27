using System;
using System.Collections.Generic;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>Before/after Optimization Snapshots taken around one batch.</summary>
    public sealed record SnapshotDiff(OptimizationSnapshot Before, OptimizationSnapshot After);

    /// <summary>Outcome of a batch: whether every Tweak applied, and the gain it produced.</summary>
    public sealed record TweakBatchResult(bool Ok, SnapshotDiff? Diff);

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
        private record TweakInfo(string Id, string Category, string RiskTier, string Kind, string State);

        private record PresetInfo(string Id, IReadOnlyList<string> TweakIds);

        private record CatalogInfo(IReadOnlyList<TweakInfo> Tweaks, IReadOnlyList<PresetInfo> Presets);

        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        private readonly TweakCatalog _catalog;
        private readonly ITweakCaptureStore _captures;
        private readonly SystemRestoreManager _systemRestore;
        private readonly SnapshotManager _snapshots;
        private readonly ISnapshotStore _history;
        private readonly IStatusSink _sink;

        /// <summary>Mirrors <see cref="Optimizer.CreateSafetyBackupEnabled"/>: the same preference.</summary>
        public bool CreateSafetyBackupEnabled { get; set; } = true;

        public TweakEngine(
            TweakCatalog catalog,
            ITweakCaptureStore captures,
            SystemRestoreManager systemRestore,
            SnapshotManager snapshots,
            ISnapshotStore history,
            IStatusSink sink
        )
        {
            _catalog = catalog;
            _captures = captures;
            _systemRestore = systemRestore;
            _snapshots = snapshots;
            _history = history;
            _sink = sink;
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
                        tweak.Detect().ToString()
                    )
                );
            }

            var presets = new List<PresetInfo>(_catalog.Presets.Count);
            foreach (Preset preset in _catalog.Presets)
                presets.Add(new PresetInfo(preset.Id, preset.TweakIds));

            return JsonSerializer.Serialize(new CatalogInfo(tweaks, presets), Options);
        }

        /// <summary>
        /// Applies a selection of Tweaks behind a Safety Checkpoint, measuring the system before and
        /// after. An unknown id fails the whole batch rather than silently applying a subset.
        /// </summary>
        public TweakBatchResult ApplyTweaks(IReadOnlyList<string> ids)
        {
            if (ids.Count == 0)
            {
                _sink.Log("log.tweaks.noneSelected", "error");
                return new TweakBatchResult(false, null);
            }

            var selected = new List<ITweak>(ids.Count);
            foreach (string id in ids)
            {
                ITweak? tweak = _catalog.Find(id);
                if (tweak == null)
                {
                    _sink.Log("log.tweaks.unknown", "error", new { id });
                    return new TweakBatchResult(false, null);
                }
                selected.Add(tweak);
            }

            _sink.Status("status.tweaks.measuring", 10);
            OptimizationSnapshot before = CaptureSnapshot();

            if (!BuildCheckpoint()) return new TweakBatchResult(false, null);

            bool ok = true;
            for (int i = 0; i < selected.Count; i++)
            {
                ITweak tweak = selected[i];
                _sink.Status(
                    "status.tweaks.applying",
                    40 + (40 * i / selected.Count),
                    new { id = tweak.Id }
                );

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
            }

            _sink.Status("status.tweaks.measuring", 90);
            OptimizationSnapshot after = CaptureSnapshot();

            _sink.Status("status.tweaks.done", 100);
            _sink.Log(ok ? "log.tweaks.done" : "log.op.completedWithErrors", ok ? "success" : "error");

            return new TweakBatchResult(ok, new SnapshotDiff(before, after));
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
            if (!CreateSafetyBackupEnabled)
            {
                _sink.Log("log.tweaks.checkpointSkipped", "info");
                return true;
            }

            try
            {
                _systemRestore.CreateRestorePoint();
                _sink.Log("log.tweaks.checkpointCreated", "success");
                return true;
            }
            catch (Exception ex)
            {
                _sink.Log("log.tweaks.checkpointFailed", "error", new { message = ex.Message });
                return false;
            }
        }
    }
}
