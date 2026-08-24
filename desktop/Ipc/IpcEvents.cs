namespace VeloSysPro
{
    /// <summary>Canonical host-to-frontend IPC Event names.</summary>
    public static class IpcEvents
    {
        public const string LogReceived = "logReceived";
        public const string StatusUpdated = "statusUpdated";
        public const string ProgressUpdated = "progressUpdated";
        public const string BackupsLoaded = "backupsLoaded";
        public const string TasksLoaded = "tasksLoaded";
        public const string RestorePointsLoaded = "restorePointsLoaded";
        public const string SettingsLoaded = "settingsLoaded";
        public const string UpdateAvailable = "updateAvailable";
        public const string ActionFinished = "actionFinished";
        public const string TweaksLoaded = "tweaksLoaded";
        public const string SnapshotCaptured = "snapshotCaptured";
        public const string HistoryLoaded = "historyLoaded";
        public const string DebloatLoaded = "debloatLoaded";
        public const string DebloatCompleted = "debloatCompleted";
    }
}
