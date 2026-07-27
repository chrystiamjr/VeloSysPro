using System;
using System.IO;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// Owns Registry Backup creation, listing, and restoration, plus the arbitrary-key export and
    /// import that back a Tweak's registry capture (docs/adr/0004-safety-checkpoint.md).
    /// </summary>
    public class RegistryBackupManager
    {
        /// <summary>Serializable shape matching the BackupItem interface in the React frontend.</summary>
        private record BackupInfo(string Name, string CreatedAt, long SizeBytes);

        /// <summary>Both the key and the label are interpolated into a reg.exe command line.</summary>
        private static readonly Regex SafeKeyPath =
            new(@"^HK(LM|CU|CR|U|CC|EY_[A-Z_]+)\\[A-Za-z0-9_.\\ \-{}]+$", RegexOptions.Compiled);

        private static readonly Regex SafeLabel = new(@"^[A-Za-z0-9_.\-]+$", RegexOptions.Compiled);

        private readonly string _backupsDir;
        private readonly string _capturesDir;
        private readonly ICommandRunner _cmd;
        private readonly IStatusSink _sink;

        public RegistryBackupManager(
            string backupsDir,
            ICommandRunner cmd,
            IStatusSink sink,
            string? capturesDir = null
        )
        {
            _backupsDir = backupsDir;
            _capturesDir = string.IsNullOrWhiteSpace(capturesDir) ? AppPaths.Captures : capturesDir;
            _cmd = cmd;
            _sink = sink;

            Directory.CreateDirectory(_backupsDir);
            Directory.CreateDirectory(_capturesDir);
        }

        /// <summary>
        /// Exports an arbitrary key to a timestamped <c>.reg</c> under the captures directory and
        /// returns its path, or an empty string when the export failed.
        /// </summary>
        /// <remarks>
        /// This is the archive half of a Tweak's capture. A Tweak reverts from its recorded values
        /// rather than by re-importing this file, because a key such as the MMCSS SystemProfile
        /// holds values owned by several Tweaks and a whole-key import would undo the others too.
        /// </remarks>
        public string ExportKey(string keyPath, string label)
        {
            if (!SafeKeyPath.IsMatch(keyPath)) throw new ArgumentException("Invalid registry key.");
            if (!SafeLabel.IsMatch(label)) throw new ArgumentException("Invalid capture label.");

            string file = Path.Combine(
                _capturesDir,
                label + "_" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff", CultureInfo.InvariantCulture) + ".reg"
            );

            CommandResult result = _cmd.Run(
                "reg.exe",
                "export \"" + keyPath + "\" \"" + file + "\" /y"
            );
            return result.Success ? file : "";
        }

        /// <summary>Re-imports a previously exported capture archive.</summary>
        public bool ImportKey(string regFile)
        {
            if (
                string.IsNullOrWhiteSpace(regFile)
                || regFile.Contains('"')
                || !regFile.EndsWith(".reg", StringComparison.OrdinalIgnoreCase)
                || !File.Exists(regFile)
            )
                return false;

            return _cmd.Run("reg.exe", "import \"" + regFile + "\"").Success;
        }

        public void CreateBackup()
        {
            string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
            string file = Path.Combine(_backupsDir, "backup_rede_" + timestamp + ".reg");
            CommandResult result = _cmd.Run(
                "reg.exe",
                "export \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\" \""
                    + file
                    + "\" /y"
            );
            if (!result.Success) throw new InvalidOperationException("Registry export failed.");
            _sink.Log("log.backup.created", "success", new { file });
        }

        /// <summary>
        /// Returns a JSON array string with all backup files info.
        /// </summary>
        public string GetBackupsJson()
        {
            DirectoryInfo di = new(_backupsDir);
            FileInfo[] files = di.GetFiles("backup_rede_*.reg");
            Array.Sort(files, (a, b) => b.LastWriteTime.CompareTo(a.LastWriteTime));

            var items = new BackupInfo[files.Length];
            for (int i = 0; i < files.Length; i++)
            {
                var f = files[i];
                items[i] = new BackupInfo(
                    f.Name,
                    f.LastWriteTimeUtc.ToString("O", CultureInfo.InvariantCulture),
                    f.Length
                );
            }

            return JsonSerializer.Serialize(items);
        }

        public void RestoreBackup(string backupName)
        {
            if (
                string.IsNullOrWhiteSpace(backupName)
                || backupName != Path.GetFileName(backupName)
                || !backupName.StartsWith("backup_rede_", StringComparison.Ordinal)
                || !backupName.EndsWith(".reg", StringComparison.OrdinalIgnoreCase)
            )
                throw new ArgumentException("Invalid Registry Backup name.");

            string filePath = Path.Combine(_backupsDir, backupName);
            if (!File.Exists(filePath)) throw new FileNotFoundException("Registry Backup not found.");

            CommandResult result = _cmd.Run("reg.exe", "import \"" + filePath + "\"");
            if (!result.Success) throw new InvalidOperationException("Registry import failed.");
            _sink.Log("log.backup.restored", "success", new { name = backupName });
        }

    }
}
