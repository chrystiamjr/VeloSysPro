using System;

namespace VeloSysPro
{
    /// <summary>
    /// Deep module encapsulating the Safety Checkpoint seam: pre-flight protection verification,
    /// System Restore point creation, TCP/IP registry backup, and safety preference enforcement.
    /// </summary>
    public sealed class SafetyCheckpoint
    {
        private readonly SystemRestoreManager _systemRestore;
        private readonly RegistryBackupManager _registryBackup;
        private readonly IStatusSink _sink;
        private readonly Action? _onBackupCreated;

        /// <summary>
        /// When true, system restore points and registry backups are enforced before mutations.
        /// </summary>
        public bool Enabled { get; set; } = true;

        public SafetyCheckpoint(
            SystemRestoreManager systemRestore,
            RegistryBackupManager registryBackup,
            IStatusSink sink,
            Action? onBackupCreated = null
        )
        {
            _systemRestore = systemRestore;
            _registryBackup = registryBackup;
            _sink = sink;
            _onBackupCreated = onBackupCreated;
        }

        /// <summary>
        /// Creates a Registry Backup before a maintenance plan (e.g. Quick/Full Optimization).
        /// </summary>
        public bool ExecuteMaintenanceBackup()
        {
            if (!Enabled) return true;
            try
            {
                _registryBackup.CreateBackup();
                _onBackupCreated?.Invoke();
                return true;
            }
            catch (Exception ex)
            {
                _sink.Log("log.backup.failed", "error", new { message = ex.Message });
                return false;
            }
        }

        /// <summary>
        /// Verifies Windows System Protection and creates a System Restore Point before an
        /// à-la-carte Tweak batch.
        /// </summary>
        public bool ExecuteTweakCheckpoint()
        {
            if (!Enabled)
            {
                _sink.Log("log.tweaks.checkpointSkipped", "info");
                return true;
            }

            if (!_systemRestore.IsProtectionEnabled())
            {
                _sink.Log("log.tweaks.protectionDisabled", "error");
                return false;
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
