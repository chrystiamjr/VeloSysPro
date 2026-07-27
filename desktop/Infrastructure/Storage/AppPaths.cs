using System;
using System.IO;

namespace VeloSysPro
{
    /// <summary>
    /// Canonical locations for mutable application data. Keeping these files under
    /// LocalApplicationData prevents a portable or development executable from polluting its folder.
    /// </summary>
    public static class AppPaths
    {
        public static string Root { get; } = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "VeloSysPro"
        );

        public static string Logs { get; } = Path.Combine(Root, "logs");
        public static string Backups { get; } = Path.Combine(Root, "backups");

        /// <summary>Per-Tweak prior state captured before a batch, so a single Tweak can be reverted.</summary>
        public static string Captures { get; } = Path.Combine(Root, "captures");

        public static string WebViewData { get; } = Path.Combine(Root, "webview_data");
        public static string SettingsFile { get; } = Path.Combine(Root, "settings.json");

        /// <summary>Append-only Optimization History (one Snapshot per line).</summary>
        public static string HistoryFile { get; } = Path.Combine(Root, "history.jsonl");

        public static void EnsureRuntimeDirectories()
        {
            Directory.CreateDirectory(Logs);
            Directory.CreateDirectory(Backups);
            Directory.CreateDirectory(Captures);
            Directory.CreateDirectory(WebViewData);
        }
    }
}
