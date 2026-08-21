namespace VeloSysPro
{
    /// <summary>Canonical IPC action names shared by the WPF host handlers.</summary>
    public static class SystemActions
    {
        public const string RunQuickOptimization = "runQuickOptimization";
        public const string RunFullOptimization = "runFullOptimization";
        public const string RevertDefaults = "revertDefaults";
        public const string ClearUpdateCache = "clearUpdateCache";
        public const string CleanPrefetch = "cleanPrefetch";
        public const string DiskHealth = "diskHealth";
        public const string CreateManualBackup = "createManualBackup";
        public const string RestoreBackup = "restoreBackup";
        public const string CreateRestorePoint = "createRestorePoint";
        public const string OpenLogs = "openLogs";
        public const string OpenUrl = "openUrl";
        public const string OpenBackups = "openBackups";
        public const string GetBackups = "getBackups";
        public const string GetTasks = "getTasks";
        public const string CreateTask = "createTask";
        public const string DeleteTask = "deleteTask";
        public const string GetRestorePoints = "getRestorePoints";
        public const string RestoreToPoint = "restoreToPoint";
        public const string GetSettings = "getSettings";
        public const string SaveSettings = "saveSettings";
        public const string LoadTweaks = "loadTweaks";
        public const string ApplyTweaks = "applyTweaks";
        public const string RevertTweak = "revertTweak";
        public const string CaptureSnapshot = "captureSnapshot";
        public const string LoadHistory = "loadHistory";
        public const string EnableSystemProtection = "enableSystemProtection";
        public const string LoadDebloat = "loadDebloat";
        public const string RunDebloat = "runDebloat";
    }
}
