using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text.Json;
using System.Threading;

namespace VeloSysPro
{
    /// <summary>
    /// Owns the Action seam: validation, routing, mutation exclusion, follow-up Events,
    /// diagnostics, and authoritative completion.
    /// </summary>
    public sealed class ActionHost
    {
        private sealed record SchedulePayload(string Type, string Frequency, string Time, string Day);

        private sealed record ApplyTweaksPayload(string[]? TweakIds, string[]? RevertIds);

        private sealed record RunDebloatPayload(string[]? PackageIds);

        private readonly Optimizer _optimizer;
        private readonly RegistryBackupManager _registryBackups;
        private readonly SystemRestoreManager _systemRestore;
        private readonly SchedulerManager _scheduler;
        private readonly SettingsManager _settings;
        private readonly TweakEngine _tweaks;
        private readonly DebloatManager _debloat;
        private readonly SafetyCheckpoint _checkpoint;
        private readonly IpcEventEmitter _events;
        private readonly IStatusSink _sink;
        private readonly string _logsDir;
        private readonly string _backupsDir;
        private readonly Dictionary<string, Func<JsonElement, bool>> _handlers;
        private readonly HashSet<string> _mutations;
        private int _mutationActive;

        public ActionHost(
            Optimizer optimizer,
            RegistryBackupManager registryBackups,
            SystemRestoreManager systemRestore,
            SchedulerManager scheduler,
            SettingsManager settings,
            TweakEngine tweaks,
            DebloatManager debloat,
            SafetyCheckpoint checkpoint,
            IpcEventEmitter events,
            IStatusSink sink,
            string logsDir,
            string backupsDir
        )
        {
            _optimizer = optimizer;
            _registryBackups = registryBackups;
            _systemRestore = systemRestore;
            _scheduler = scheduler;
            _settings = settings;
            _tweaks = tweaks;
            _debloat = debloat;
            _checkpoint = checkpoint;
            _events = events;
            _sink = sink;
            _logsDir = logsDir;
            _backupsDir = backupsDir;

            _mutations = new HashSet<string>
            {
                SystemActions.RunQuickOptimization,
                SystemActions.RunFullOptimization,
                SystemActions.RevertDefaults,
                SystemActions.ClearUpdateCache,
                SystemActions.CleanPrefetch,
                SystemActions.CreateManualBackup,
                SystemActions.RestoreBackup,
                SystemActions.CreateRestorePoint,
                SystemActions.RestoreToPoint,
                SystemActions.CreateTask,
                SystemActions.DeleteTask,
                SystemActions.SaveSettings,
                SystemActions.ApplyTweaks,
                SystemActions.RevertTweak,
                SystemActions.EnableSystemProtection,
                SystemActions.RunDebloat,
            };

            _handlers = CreateHandlers();
        }

        public void Handle(IpcHandler.IpcMessage message)
        {
            ThreadPool.QueueUserWorkItem(_ => Execute(message));
        }

        private void Execute(IpcHandler.IpcMessage message)
        {
            bool mutation = _mutations.Contains(message.Action);
            if (mutation && Interlocked.CompareExchange(ref _mutationActive, 1, 0) != 0)
            {
                _sink.LogRaw("Mutating Action rejected while another mutation is active.", "error");
                _events.Emit(IpcEvents.ActionFinished, new { action = message.Action, ok = false });
                return;
            }

            bool ok = false;
            try
            {
                if (!_handlers.TryGetValue(message.Action, out var handler))
                    throw new InvalidOperationException("Unknown Action: " + message.Action);
                ok = handler(message.Payload);
            }
            catch (Exception ex)
            {
                _sink.LogRaw("Action '" + message.Action + "' failed: " + ex.Message, "error");
            }
            finally
            {
                if (mutation) Interlocked.Exchange(ref _mutationActive, 0);
                _events.Emit(IpcEvents.ActionFinished, new { action = message.Action, ok });
            }
        }

        private Dictionary<string, Func<JsonElement, bool>> CreateHandlers() =>
            new()
            {
                [SystemActions.RunQuickOptimization] = _ => RunPlan(OptimizationPlan.Quick),
                [SystemActions.RunFullOptimization] = _ => RunPlan(OptimizationPlan.Full),
                [SystemActions.RevertDefaults] = _ => _optimizer.Execute(OptimizationPlan.Revert),
                [SystemActions.ClearUpdateCache] = _ => _optimizer.ClearUpdateCache(),
                [SystemActions.CleanPrefetch] = _ => _optimizer.CleanPrefetch(),
                [SystemActions.DiskHealth] = _ => _optimizer.ReportDiskHealth(),
                [SystemActions.CreateManualBackup] = _ => MutateAndRefresh(
                    _registryBackups.CreateBackup,
                    PushBackups
                ),
                [SystemActions.RestoreBackup] = payload =>
                    Run(() => _registryBackups.RestoreBackup(ReadString(payload))),
                [SystemActions.CreateRestorePoint] = _ => MutateAndRefresh(
                    _systemRestore.CreateRestorePoint,
                    PushRestorePoints
                ),
                [SystemActions.GetRestorePoints] = _ => Run(PushRestorePoints),
                [SystemActions.RestoreToPoint] = payload =>
                    Run(() => _systemRestore.RestoreToPoint(ReadInt(payload).ToString())),
                [SystemActions.GetSettings] = _ => Run(PushSettings),
                [SystemActions.SaveSettings] = payload => SaveSettings(payload),
                [SystemActions.OpenUrl] = payload => OpenUrl(ReadString(payload)),
                [SystemActions.OpenLogs] = _ => OpenFolder(_logsDir),
                [SystemActions.OpenBackups] = _ => OpenFolder(_backupsDir),
                [SystemActions.GetBackups] = _ => Run(PushBackups),
                [SystemActions.GetTasks] = _ => Run(PushTasks),
                [SystemActions.CreateTask] = payload => CreateTask(payload),
                [SystemActions.DeleteTask] = payload =>
                    MutateAndRefresh(() => _scheduler.DeleteTask(ReadString(payload)), PushTasks),
                [SystemActions.LoadTweaks] = _ => Run(PushTweaks),
                [SystemActions.ApplyTweaks] = payload => ApplyTweaks(payload),
                [SystemActions.RevertTweak] = payload =>
                    MutateAndRefresh(() => _tweaks.RevertTweak(ReadString(payload)), PushTweaks),
                [SystemActions.CaptureSnapshot] = _ => Run(PushSnapshot),
                [SystemActions.LoadHistory] = _ => Run(PushHistory),
                [SystemActions.EnableSystemProtection] = _ =>
                    MutateAndRefresh(_tweaks.EnableSystemProtection, PushTweaks),
                [SystemActions.LoadDebloat] = _ => Run(PushDebloat),
                [SystemActions.RunDebloat] = payload => RunDebloat(payload),
            };

        /// <summary>
        /// Uninstalls the selected preinstalled apps and reports each one separately.
        /// </summary>
        /// <remarks>
        /// An empty <c>Results</c> means the batch was refused before it touched anything — an id
        /// outside the allow-list, or a Safety Checkpoint that could not be built. There is nothing
        /// to report and nothing to refresh in that case, and re-reading the list would only make
        /// it look as though something had been attempted.
        /// </remarks>
        private bool RunDebloat(JsonElement payload)
        {
            RunDebloatPayload parsed = ReadObject<RunDebloatPayload>(payload);
            string[] ids = parsed.PackageIds ?? Array.Empty<string>();
            if (ids.Length == 0)
                throw new ArgumentException("runDebloat requires at least one package id.");

            DebloatBatchResult result = _debloat.Remove(ids);

            if (result.Results.Count > 0)
            {
                _events.Emit(IpcEvents.DebloatCompleted, new { results = result.Results });
                PushDebloat();
            }

            return result.Ok;
        }

        private bool ApplyTweaks(JsonElement payload)
        {
            ApplyTweaksPayload parsed = ReadObject<ApplyTweaksPayload>(payload);
            string[] toApply = parsed.TweakIds ?? Array.Empty<string>();
            string[] toRevert = parsed.RevertIds ?? Array.Empty<string>();
            if (toApply.Length == 0 && toRevert.Length == 0)
                throw new ArgumentException("applyTweaks requires at least one Tweak id.");

            TweakBatchResult result = _tweaks.ApplyTweaks(toApply, toRevert);

            // A null diff means the batch never got past its Safety Checkpoint, so nothing was
            // touched. Once it did run, the badges must reflect reality even if one Tweak failed —
            // a stale "not applied" badge on a Tweak that is now applied is worse than a partial
            // refresh (.agents/rules/os-backed-list-freshness.md).
            if (result.Diff != null)
            {
                _events.Emit(
                    IpcEvents.SnapshotCaptured,
                    new
                    {
                        before = result.Diff.Before,
                        after = result.Diff.After,
                        changes = result.Changes,
                    }
                );
                PushTweaks();
            }

            return result.Ok;
        }

        private bool RunPlan(OptimizationPlan plan)
        {
            bool ok = _optimizer.Execute(plan);
            if (ok && _optimizer.CreateSafetyBackupEnabled) PushBackups();
            return ok;
        }

        private bool CreateTask(JsonElement payload)
        {
            SchedulePayload parsed = ReadObject<SchedulePayload>(payload);
            ScheduleSpec schedule = SchedulePolicy.Normalize(
                parsed.Type,
                parsed.Frequency,
                parsed.Day,
                parsed.Time
            );
            return MutateAndRefresh(() => _scheduler.CreateTask(schedule), PushTasks);
        }

        private bool SaveSettings(JsonElement payload)
        {
            SettingsManager.Settings settings = ReadObject<SettingsManager.Settings>(payload);
            SettingsManager.Settings applied = _settings.Save(settings);
            _optimizer.CreateSafetyBackupEnabled = applied.CreateBackupBeforeOptimize;
            _checkpoint.Enabled = applied.CreateBackupBeforeOptimize;
            PushSettings();
            return true;
        }

        private bool MutateAndRefresh(Action mutation, Action refresh)
        {
            mutation();
            refresh();
            return true;
        }

        /// <summary>Refresh-after-success for a mutation that reports failure instead of throwing.</summary>
        private static bool MutateAndRefresh(Func<bool> mutation, Action refresh)
        {
            if (!mutation()) return false;
            refresh();
            return true;
        }

        private static bool Run(Action action)
        {
            action();
            return true;
        }

        private void PushBackups() =>
            _events.EmitJson(IpcEvents.BackupsLoaded, _registryBackups.GetBackupsJson());

        private void PushTasks() =>
            _events.EmitJson(IpcEvents.TasksLoaded, _scheduler.GetTasksJson());

        private void PushRestorePoints() =>
            _events.EmitJson(IpcEvents.RestorePointsLoaded, _systemRestore.GetRestorePointsJson());

        private void PushSettings() => _events.Emit(IpcEvents.SettingsLoaded, _settings.Current);

        private void PushTweaks() => _events.EmitJson(IpcEvents.TweaksLoaded, _tweaks.GetTweaksJson());

        /// <summary>A standalone measurement has no "before" to compare against, and changed nothing.</summary>
        private void PushSnapshot() =>
            _events.Emit(
                IpcEvents.SnapshotCaptured,
                new
                {
                    before = (OptimizationSnapshot?)null,
                    after = _tweaks.CaptureSnapshot(),
                    changes = Array.Empty<TweakChange>(),
                }
            );

        private void PushDebloat() =>
            _events.EmitJson(IpcEvents.DebloatLoaded, _debloat.GetPackagesJson());

        private void PushHistory() => _events.Emit(IpcEvents.HistoryLoaded, _tweaks.LoadHistory());

        private static string ReadString(JsonElement payload)
        {
            if (payload.ValueKind != JsonValueKind.String)
                throw new ArgumentException("Action payload must be a string.");
            return payload.GetString() ?? throw new ArgumentException("Action payload is empty.");
        }

        private static int ReadInt(JsonElement payload)
        {
            if (!payload.TryGetInt32(out int value) || value < 0)
                throw new ArgumentException("Action payload must be a non-negative integer.");
            return value;
        }

        private static T ReadObject<T>(JsonElement payload)
        {
            T? value = payload.Deserialize<T>(
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );
            return value ?? throw new ArgumentException("Action payload is invalid.");
        }

        private static bool OpenUrl(string url)
        {
            if (!url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Only HTTPS URLs are allowed.");
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
            return true;
        }

        private static bool OpenFolder(string path)
        {
            Process.Start("explorer.exe", path);
            return true;
        }
    }
}
