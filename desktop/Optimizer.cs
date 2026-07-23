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
            _sink.Status("statusQuickStart", 10);
            _sink.Log("logQuickStart", "info");
            CreateSafetyBackup();

            _sink.Status("statusQuickDns", 30);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("statusQuickCleanmgr", 65);
            _cmd.Run("cleanmgr.exe", "/verylowdisk");

            _sink.Status("statusQuickTemp", 90);
            _cmd.CleanTempFolder();

            _sink.Status("statusQuickDone", 100);
            _sink.Log("logQuickDone", "success");
        }

        public void RunFull()
        {
            _sink.Status("statusFullStart", 10);
            _sink.Log("logFullStart", "info");
            CreateSafetyBackup();

            _sink.Status("statusFullSfc", 25);
            _cmd.Run("sfc.exe", "/scannow");

            _sink.Status("statusFullDism", 50);
            _cmd.Run("dism.exe", "/online /cleanup-image /restorehealth");

            _sink.Status("statusFullDns", 75);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("statusFullTemp", 90);
            _cmd.CleanTempFolder();

            _sink.Status("statusFullDone", 100);
            _sink.Log("logFullDone", "success");
        }

        public void RunGaming()
        {
            _sink.Status("statusGamingStart", 10);
            _sink.Log("logGamingStart", "info");
            CreateSafetyBackup();

            _sink.Status("statusGamingRss", 40);
            _cmd.Run("netsh.exe", "int tcp set global rss=enabled");

            _sink.Status("statusGamingAutotuning", 70);
            _cmd.Run("netsh.exe", "int tcp set global autotuninglevel=normal");

            _sink.Status("statusGamingDns", 90);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("statusGamingDone", 100);
            _sink.Log("logGamingDone", "success");
        }

        public void RevertDefaults()
        {
            _sink.Status("statusRevertStart", 10);
            _sink.Log("logRevertStart", "info");

            _sink.Status("statusRevertIp", 40);
            _cmd.Run("netsh.exe", "int ip reset");

            _sink.Status("statusRevertWinsock", 70);
            _cmd.Run("netsh.exe", "winsock reset");

            _sink.Status("statusRevertDns", 90);
            _cmd.Run("ipconfig.exe", "/flushdns");

            _sink.Status("statusRevertDone", 100);
            _sink.Log("logRevertDone", "success");
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
