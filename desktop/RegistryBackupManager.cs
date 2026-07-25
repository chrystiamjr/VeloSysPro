using System;
using System.IO;
using System.Globalization;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Owns Registry Backup creation, listing, and restoration.
    /// </summary>
    public class RegistryBackupManager
    {
        /// <summary>Serializable shape matching the BackupItem interface in the React frontend.</summary>
        private record BackupInfo(string Name, string CreatedAt, long SizeBytes);

        private readonly string _backupsDir;
        private readonly ICommandRunner _cmd;
        private readonly IStatusSink _sink;

        public RegistryBackupManager(string backupsDir, ICommandRunner cmd, IStatusSink sink)
        {
            _backupsDir = backupsDir;
            _cmd = cmd;
            _sink = sink;

            Directory.CreateDirectory(_backupsDir);
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
