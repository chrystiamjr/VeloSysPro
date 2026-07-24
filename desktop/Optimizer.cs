using System;

namespace VeloSysPro
{
    /// <summary>
    /// System optimization orchestration, decoupled from the WPF window so it can be
    /// driven by both the UI and the headless CLI mode. Emits i18n keys via IStatusSink.
    /// Final result is derived from command exit codes (not stderr presence).
    /// </summary>
    public class Optimizer
    {
        private readonly CommandRunner _cmd;
        private readonly BackupManager _backup;
        private readonly IStatusSink _sink;
        private readonly Action? _onBackupsChanged;

        /// <summary>When true, a registry safety backup is taken before an optimization.</summary>
        public bool CreateSafetyBackupEnabled { get; set; } = true;

        public Optimizer(CommandRunner cmd, BackupManager backup, IStatusSink sink, Action? onBackupsChanged = null)
        {
            _cmd = cmd;
            _backup = backup;
            _sink = sink;
            _onBackupsChanged = onBackupsChanged;
        }

        private void CreateSafetyBackup()
        {
            if (!CreateSafetyBackupEnabled) return;
            _backup.CreateBackup();
            _onBackupsChanged?.Invoke();
        }

        /// <summary>Emits the final log: the op's "done" key on success, or a shared error key.</summary>
        private void Finish(bool ok, string doneKey)
        {
            if (ok) _sink.Log(doneKey, "success");
            else _sink.Log("log.op.completedWithErrors", "error");
        }

        public void RunQuick()
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
            Finish(ok, "log.quick.done");
        }

        public void RunFull()
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
            Finish(ok, "log.full.done");
        }

        public void RunGaming()
        {
            _sink.Status("status.gaming.start", 10);
            _sink.Log("log.gaming.start", "info");
            CreateSafetyBackup();

            bool ok = true;
            _sink.Status("status.gaming.rss", 40);
            ok &= _cmd.Run("netsh.exe", "int tcp set global rss=enabled").Success;

            _sink.Status("status.gaming.autotuning", 70);
            ok &= _cmd.Run("netsh.exe", "int tcp set global autotuninglevel=normal").Success;

            _sink.Status("status.gaming.dns", 90);
            ok &= _cmd.Run("ipconfig.exe", "/flushdns").Success;

            _sink.Status("status.gaming.done", 100);
            Finish(ok, "log.gaming.done");
        }

        public void RevertDefaults()
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
            Finish(ok, "log.revert.done");
        }

        public void ClearUpdateCache()
        {
            _sink.Status("status.updateCache.start", 20);
            _sink.Log("log.updateCache.start", "info");

            bool ok = true;
            ok &= _cmd.Run("net.exe", "stop wuauserv").Success;
            string windir = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            _cmd.ClearDirectory(System.IO.Path.Combine(windir, "SoftwareDistribution", "Download"));
            ok &= _cmd.Run("net.exe", "start wuauserv").Success;

            _sink.Status("status.updateCache.done", 100);
            Finish(ok, "log.updateCache.done");
        }

        public void CleanPrefetch()
        {
            _sink.Status("status.prefetch.start", 30);
            _sink.Log("log.prefetch.start", "info");

            string windir = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            _cmd.ClearDirectory(System.IO.Path.Combine(windir, "Prefetch"));

            _sink.Status("status.prefetch.done", 100);
            _sink.Log("log.prefetch.done", "success");
        }

        public void ReportDiskHealth()
        {
            _sink.Status("status.diskHealth.start", 40);
            _sink.Log("log.diskHealth.start", "info");

            const string ps =
                "Get-PhysicalDisk | Select-Object FriendlyName, MediaType, HealthStatus, " +
                "@{N='Size(GB)';E={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize | Out-String";
            _cmd.Run("powershell.exe", "-ExecutionPolicy Bypass -Command \"" + ps + "\"");

            _sink.Status("status.diskHealth.done", 100);
            _sink.Log("log.diskHealth.done", "success");
        }

        /// <summary>Runs an optimization by its CLI task name (used by headless mode).</summary>
        public bool RunByName(string task)
        {
            switch (task.ToLowerInvariant())
            {
                case "quick":
                    RunQuick();
                    return true;
                case "full":
                    RunFull();
                    return true;
                case "gaming":
                    RunGaming();
                    return true;
                case "revert":
                    RevertDefaults();
                    return true;
                default:
                    return false;
            }
        }
    }
}
