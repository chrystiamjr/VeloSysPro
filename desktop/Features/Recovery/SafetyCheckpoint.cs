using System;

namespace VeloSysPro
{
    /// <summary>
    /// The restore point every batch of system changes runs behind, and the single place that
    /// decides whether the batch is allowed to proceed without one.
    /// </summary>
    /// <remarks>
    /// This lives on its own because two different features now depend on it — a Tweak batch and a
    /// Debloat removal — and a safety net that exists on only one of the paths that needs it is a
    /// failure this project has already had once (`.agents/rules/absence-of-error-is-not-success.md`).
    /// Debloat needs it more than Tweaks do: an uninstalled app cannot be reverted in-app at all,
    /// so the restore point is the only way back.
    /// </remarks>
    public sealed class SafetyCheckpoint
    {
        private readonly SystemRestoreManager _systemRestore;
        private readonly IStatusSink _sink;

        public SafetyCheckpoint(SystemRestoreManager systemRestore, IStatusSink sink)
        {
            _systemRestore = systemRestore;
            _sink = sink;
        }

        /// <summary>
        /// Whether a checkpoint is required before a batch. Mirrors the user's
        /// "create a safety backup before optimizing" preference.
        /// </summary>
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Builds the checkpoint, or reports why the batch must not run.
        /// </summary>
        /// <remarks>
        /// A failed restore point stops the batch: the user asked for a change with a safety net,
        /// and proceeding without one silently would not be the thing they asked for.
        /// </remarks>
        public bool Build()
        {
            if (!Enabled)
            {
                _sink.Log("log.checkpoint.skipped", "info");
                return true;
            }

            // Checked before attempting the checkpoint so the user gets the one message they can
            // act on — "turn System Protection on" — instead of a restore-point failure.
            if (!_systemRestore.IsProtectionEnabled())
            {
                _sink.Log("log.checkpoint.protectionDisabled", "error");
                return false;
            }

            try
            {
                _systemRestore.CreateRestorePoint();
                _sink.Log("log.checkpoint.created", "success");
                return true;
            }
            catch (Exception ex)
            {
                _sink.Log("log.checkpoint.failed", "error", new { message = ex.Message });
                return false;
            }
        }
    }
}
