using System;
using System.IO;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Loads and persists user preferences in %LOCALAPPDATA%\VeloSysPro\settings.json.
    /// </summary>
    public class SettingsManager
    {
        public record Settings(string Language, bool CreateBackupBeforeOptimize, bool SidebarCollapsed = false);

        private static readonly JsonSerializerOptions Opts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };

        private readonly string _file;
        private Settings _current = new("pt_BR", true);

        public SettingsManager(string? settingsFile = null)
        {
            if (!string.IsNullOrWhiteSpace(settingsFile))
            {
                string? parent = Path.GetDirectoryName(settingsFile);
                if (!string.IsNullOrEmpty(parent)) Directory.CreateDirectory(parent);
                _file = settingsFile;
                Load();
                return;
            }

            Directory.CreateDirectory(AppPaths.Root);
            _file = AppPaths.SettingsFile;
            Load();
        }

        public Settings Current => _current;

        private void Load()
        {
            try
            {
                if (File.Exists(_file))
                {
                    Settings? s = JsonSerializer.Deserialize<Settings>(File.ReadAllText(_file), Opts);
                    if (IsValid(s)) _current = s!;
                }
            }
            catch { }
        }

        public string GetJson() => JsonSerializer.Serialize(_current, Opts);

        /// <summary>Persists settings from a JSON payload and returns the applied settings.</summary>
        public Settings Save(string payloadJson)
        {
            try
            {
                Settings? s = JsonSerializer.Deserialize<Settings>(payloadJson, Opts);
                if (IsValid(s))
                {
                    _current = s!;
                    File.WriteAllText(_file, JsonSerializer.Serialize(_current, Opts));
                }
            }
            catch { }
            return _current;
        }

        public Settings Save(Settings settings)
        {
            if (!IsValid(settings)) throw new ArgumentException("Invalid preferences.");
            _current = settings;
            File.WriteAllText(_file, JsonSerializer.Serialize(_current, Opts));
            return _current;
        }

        private static bool IsValid(Settings? settings) =>
            settings != null
            && (settings.Language == "pt_BR" || settings.Language == "en_US");
    }
}
