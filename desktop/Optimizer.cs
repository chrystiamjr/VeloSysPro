using System;

namespace VeloSysPro
{
    /// <summary>
    /// System optimization orchestration, decoupled from the WPF window so it can be
    /// driven by both the UI and the headless CLI mode. Emits i18n keys via IStatusSink.
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

        public void RunQuick()
        {
            _sink.Status("status.quick.start", 10);
            _sink.Log("log.quick.start", "info");
            CreateSafetyBackup();

            _sink.Status("status.quick.dns", 30);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("status.quick.cleanmgr", 65);
            _cmd.Run("cleanmgr.exe", "/verylowdisk");

            _sink.Status("status.quick.temp", 90);
            _cmd.CleanTempFolder();

            _sink.Status("status.quick.done", 100);
            _sink.Log("log.quick.done", "success");
        }

        public void RunFull()
        {
            _sink.Status("status.full.start", 10);
            _sink.Log("log.full.start", "info");
            CreateSafetyBackup();

            _sink.Status("status.full.sfc", 25);
            _cmd.Run("sfc.exe", "/scannow");

            _sink.Status("status.full.dism", 50);
            _cmd.Run("dism.exe", "/online /cleanup-image /restorehealth");

            _sink.Status("status.full.dns", 75);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("status.full.temp", 90);
            _cmd.CleanTempFolder();

            _sink.Status("status.full.done", 100);
            _sink.Log("log.full.done", "success");
        }

        public void RunGaming()
        {
            _sink.Status("status.gaming.start", 10);
            _sink.Log("log.gaming.start", "info");
            CreateSafetyBackup();

            _sink.Status("status.gaming.rss", 40);
            _cmd.Run("netsh.exe", "int tcp set global rss=enabled");

            _sink.Status("status.gaming.autotuning", 70);
            _cmd.Run("netsh.exe", "int tcp set global autotuninglevel=normal");

            _sink.Status("status.gaming.dns", 90);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("status.gaming.done", 100);
            _sink.Log("log.gaming.done", "success");
        }

        public void RevertDefaults()
        {
            _sink.Status("status.revert.start", 10);
            _sink.Log("log.revert.start", "info");

            _sink.Status("status.revert.ip", 40);
            _cmd.Run("netsh.exe", "int ip reset");

            _sink.Status("status.revert.winsock", 70);
            _cmd.Run("netsh.exe", "winsock reset");

            _sink.Status("status.revert.dns", 90);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("status.revert.done", 100);
            _sink.Log("log.revert.done", "success");
        }

        public void ClearUpdateCache()
        {
            _sink.Status("status.updateCache.start", 20);
            _sink.Log("log.updateCache.start", "info");

            _cmd.Run("net.exe", "stop wuauserv");
            string windir = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            _cmd.ClearDirectory(System.IO.Path.Combine(windir, "SoftwareDistribution", "Download"));
            _cmd.Run("net.exe", "start wuauserv");

            _sink.Status("status.updateCache.done", 100);
            _sink.Log("log.updateCache.done", "success");
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
