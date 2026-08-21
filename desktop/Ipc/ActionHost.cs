using System;
using System.Threading;

namespace VeloSysPro
{
    /// <summary>
    /// Owns the Action execution seam: concurrency control, background ThreadPool dispatch,
    /// diagnostic logging, and authoritative completion Events.
    /// </summary>
    public sealed class ActionHost
    {
        private readonly ActionRegistry _registry;
        private readonly IpcEventEmitter _events;
        private readonly IStatusSink _sink;
        private int _mutationActive;

        public ActionHost(ActionRegistry registry, IpcEventEmitter events, IStatusSink sink)
        {
            _registry = registry;
            _events = events;
            _sink = sink;
        }

        public ActionHost(
            Optimizer optimizer,
            RegistryBackupManager registryBackups,
            SystemRestoreManager systemRestore,
            SchedulerManager scheduler,
            SettingsManager settings,
            TweakEngine tweaks,
            IpcEventEmitter events,
            IStatusSink sink,
            string logsDir,
            string backupsDir
        )
            : this(
                new ActionRegistry(
                    optimizer,
                    registryBackups,
                    systemRestore,
                    scheduler,
                    settings,
                    tweaks,
                    events,
                    logsDir,
                    backupsDir
                ),
                events,
                sink
            )
        {
        }

        public void Handle(IpcHandler.IpcMessage message)
        {
            ThreadPool.QueueUserWorkItem(_ => Execute(message));
        }

        public void Execute(IpcHandler.IpcMessage message)
        {
            bool mutation = _registry.IsMutation(message.Action);
            if (mutation && Interlocked.CompareExchange(ref _mutationActive, 1, 0) != 0)
            {
                _sink.LogRaw("Mutating Action rejected while another mutation is active.", "error");
                _events.Emit(IpcEvents.ActionFinished, new { action = message.Action, ok = false });
                return;
            }

            bool ok = false;
            try
            {
                ok = _registry.Execute(message.Action, message.Payload);
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
    }
}
