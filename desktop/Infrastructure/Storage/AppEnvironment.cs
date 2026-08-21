using System;
using System.IO;

namespace VeloSysPro
{
    /// <summary>
    /// Encapsulates application storage topology and directory provisioning.
    /// </summary>
    public sealed class AppEnvironment : IAppEnvironment
    {
        public static IAppEnvironment Default { get; } = new AppEnvironment();

        public string Root { get; }
        public string Logs { get; }
        public string Backups { get; }
        public string Captures { get; }
        public string WebViewData { get; }
        public string SettingsFile { get; }
        public string HistoryFile { get; }

        public AppEnvironment(string? customRoot = null)
        {
            Root = string.IsNullOrWhiteSpace(customRoot)
                ? Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "VeloSysPro"
                )
                : customRoot;

            Logs = Path.Combine(Root, "logs");
            Backups = Path.Combine(Root, "backups");
            Captures = Path.Combine(Root, "captures");
            WebViewData = Path.Combine(Root, "webview_data");
            SettingsFile = Path.Combine(Root, "settings.json");
            HistoryFile = Path.Combine(Root, "history.jsonl");
        }

        public void EnsureRuntimeDirectories()
        {
            Directory.CreateDirectory(Logs);
            Directory.CreateDirectory(Backups);
            Directory.CreateDirectory(Captures);
            Directory.CreateDirectory(WebViewData);
        }
    }
}
