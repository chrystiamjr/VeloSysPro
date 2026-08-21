namespace VeloSysPro
{
    /// <summary>
    /// Seam for resolving application directories and file storage topology.
    /// </summary>
    public interface IAppEnvironment
    {
        string Root { get; }
        string Logs { get; }
        string Backups { get; }
        string Captures { get; }
        string WebViewData { get; }
        string SettingsFile { get; }
        string HistoryFile { get; }
        void EnsureRuntimeDirectories();
    }
}
