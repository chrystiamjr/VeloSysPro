namespace VeloSysPro
{
    /// <summary>
    /// Canonical locations for mutable application data, delegating to AppEnvironment.Default.
    /// </summary>
    public static class AppPaths
    {
        public static string Root => AppEnvironment.Default.Root;
        public static string Logs => AppEnvironment.Default.Logs;
        public static string Backups => AppEnvironment.Default.Backups;
        public static string Captures => AppEnvironment.Default.Captures;
        public static string WebViewData => AppEnvironment.Default.WebViewData;
        public static string SettingsFile => AppEnvironment.Default.SettingsFile;
        public static string HistoryFile => AppEnvironment.Default.HistoryFile;

        public static void EnsureRuntimeDirectories() =>
            AppEnvironment.Default.EnsureRuntimeDirectories();
    }
}
