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
        public static string WebViewData { get; } = Path.Combine(Root, "webview_data");
        public static string SettingsFile { get; } = Path.Combine(Root, "settings.json");

        public static void EnsureRuntimeDirectories()
        {
            Directory.CreateDirectory(Logs);
            Directory.CreateDirectory(Backups);
            Directory.CreateDirectory(WebViewData);
        }
    }
}
