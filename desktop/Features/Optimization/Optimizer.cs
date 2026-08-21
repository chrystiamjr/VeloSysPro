using System;

namespace VeloSysPro
{
    /// <summary>
    /// The maintenance recipes. <c>Gaming</c> used to sit here, writing TCP globals through
    /// <c>netsh</c> with no capture and no undo; it is now the <c>gaming</c> Tweak Preset, which
    /// runs behind a Safety Checkpoint and can be reverted setting by setting.
    /// </summary>
    public enum OptimizationPlan
    {
        Quick,
        Full,
        Revert,
    }

    /// <summary>
    /// System optimization orchestration, decoupled from the WPF window so it can be
    /// driven by both the UI and the headless CLI mode. Emits i18n keys via IStatusSink.
    /// Final result is derived from command exit codes (not stderr presence).
    /// </summary>
    public class Optimizer
    {
        private readonly ICommandRunner _cmd;
        private readonly SafetyCheckpoint _safety;
        private readonly IStatusSink _sink;

        /// <summary>When true, a registry safety backup is taken before an optimization.</summary>
        public bool CreateSafetyBackupEnabled
        {
            get => _safety.Enabled;
            set => _safety.Enabled = value;
        }

        public Optimizer(ICommandRunner cmd, SafetyCheckpoint safety, IStatusSink sink)
        {
            _cmd = cmd;
            _safety = safety;
            _sink = sink;
        }

        public Optimizer(ICommandRunner cmd, RegistryBackupManager backup, IStatusSink sink, Action? onBackupsChanged = null)
            : this(cmd, new SafetyCheckpoint(new SystemRestoreManager(cmd, sink), backup, sink, onBackupsChanged), sink)
        {
        }

        private void CreateSafetyBackup()
        {
            _safety.ExecuteMaintenanceBackup();
        }

        /// <summary>Emits the final log: the op's "done" key on success, or a shared error key.</summary>
        private bool Finish(bool ok, string doneKey)
        {
            if (ok) _sink.Log(doneKey, "success");
            else _sink.Log("log.op.completedWithErrors", "error");
            return ok;
        }

        public bool Execute(OptimizationPlan plan) =>
            plan switch
            {
                OptimizationPlan.Quick => RunQuick(),
                OptimizationPlan.Full => RunFull(),
                OptimizationPlan.Revert => RevertDefaults(),
                _ => false,
            };

        private bool RunQuick()
        {
            _sink.Status("status.quick.start", 10);
            _sink.Log("log.quick.start", "info");
            CreateSafetyBackup();

            bool ok = true;
            _sink.Status("status.quick.dns", 30);
            ok &= _cmd.Run("ipconfig.exe", "/flushdns").Success;

            _sink.Status("status.quick.cleanmgr", 65);
            ok &= _cmd.Run("cleanmgr.exe", "/verylowdisk").Success;

            _sink.Status("status.quick.temp", 90);
            _cmd.CleanTempFolder();

            _sink.Status("status.quick.done", 100);
            return Finish(ok, "log.quick.done");
        }

        private bool RunFull()
        {
            _sink.Status("status.full.start", 10);
            _sink.Log("log.full.start", "info");
            CreateSafetyBackup();

            bool ok = true;
            _sink.Status("status.full.sfc", 25);
            ok &= _cmd.Run("sfc.exe", "/scannow").Success;

            _sink.Status("status.full.dism", 50);
            ok &= _cmd.Run("dism.exe", "/online /cleanup-image /restorehealth").Success;

            _sink.Status("status.full.dns", 75);
            ok &= _cmd.Run("ipconfig.exe", "/flushdns").Success;

            _sink.Status("status.full.temp", 90);
            _cmd.CleanTempFolder();

            _sink.Status("status.full.done", 100);
            return Finish(ok, "log.full.done");
        }

        private bool RevertDefaults()
        {
            _sink.Status("status.revert.start", 10);
            _sink.Log("log.revert.start", "info");

            bool ok = true;
            _sink.Status("status.revert.ip", 40);
            ok &= _cmd.Run("netsh.exe", "int ip reset").Success;

            _sink.Status("status.revert.winsock", 70);
            ok &= _cmd.Run("netsh.exe", "winsock reset").Success;

            _sink.Status("status.revert.dns", 90);
            ok &= _cmd.Run("ipconfig.exe", "/flushdns").Success;

            _sink.Status("status.revert.done", 100);
            return Finish(ok, "log.revert.done");
        }

        public bool ClearUpdateCache()
        {
            _sink.Status("status.updateCache.start", 20);
            _sink.Log("log.updateCache.start", "info");

            bool ok = true;
            ok &= _cmd.Run("net.exe", "stop wuauserv").Success;
            string windir = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            _cmd.ClearDirectory(System.IO.Path.Combine(windir, "SoftwareDistribution", "Download"));
            ok &= _cmd.Run("net.exe", "start wuauserv").Success;

            _sink.Status("status.updateCache.done", 100);
            return Finish(ok, "log.updateCache.done");
        }

        public bool CleanPrefetch()
        {
            _sink.Status("status.prefetch.start", 30);
            _sink.Log("log.prefetch.start", "info");

            string windir = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            _cmd.ClearDirectory(System.IO.Path.Combine(windir, "Prefetch"));

            _sink.Status("status.prefetch.done", 100);
            _sink.Log("log.prefetch.done", "success");
            return true;
        }

        public bool ReportDiskHealth()
        {
            _sink.Status("status.diskHealth.start", 40);
            _sink.Log("log.diskHealth.start", "info");

            const string ps =
                "Get-PhysicalDisk | Select-Object FriendlyName, MediaType, HealthStatus, " +
                "@{N='Size(GB)';E={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize | Out-String";
            bool ok = _cmd
                .Run("powershell.exe", "-ExecutionPolicy Bypass -Command \"" + ps + "\"")
                .Success;

            _sink.Status("status.diskHealth.done", 100);
            return Finish(ok, "log.diskHealth.done");
        }

        /// <summary>Runs an optimization by its CLI task name (used by headless mode).</summary>
        public bool RunByName(string task)
        {
            if (!Enum.TryParse(task, ignoreCase: true, out OptimizationPlan plan)) return false;
            return Execute(plan);
        }
    }
}
