using System;
using System.IO;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Manages registry backup creation, listing, and restore point operations.
    /// </summary>
    public class BackupManager
    {
        /// <summary>Serializable shape matching the BackupItem interface in the React frontend.</summary>
        private record BackupInfo(string Name, string Date, string Size);

        private readonly string _backupsDir;
        private readonly CommandRunner _cmd;
        private readonly IStatusSink _sink;

        public BackupManager(string backupsDir, CommandRunner cmd, IStatusSink sink)
        {
            _backupsDir = backupsDir;
            _cmd = cmd;
            _sink = sink;

            Directory.CreateDirectory(_backupsDir);
        }

        public void CreateBackup()
        {
            try
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
                string file = Path.Combine(_backupsDir, "backup_rede_" + timestamp + ".reg");
                _cmd.Run("reg.exe", "export \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\" \"" + file + "\" /y");
                _sink.Log("logBackupCreated", "success", new { file });
            }
            catch (Exception ex)
            {
                _sink.Log("logBackupFailed", "error", new { message = ex.Message });
            }
        }

        public void CreateRestorePoint()
        {
            _sink.Status("statusRestorePointCreating", 20);
            _sink.Log("logRestorePointCreating", "info");
            try
            {
                string psCmd = "Checkpoint-Computer -Description 'VeloSysPro_" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss") + "' -RestorePointType 'MODIFY_SETTINGS'";
                _cmd.Run("powershell.exe", "-ExecutionPolicy Bypass -Command \"" + psCmd + "\"");
                _sink.Status("statusRestorePointDone", 100);
                _sink.Log("logRestorePointDone", "success");
            }
            catch (Exception ex)
            {
                _sink.Log("logRestorePointFailed", "error", new { message = ex.Message });
            }
        }

        /// <summary>
        /// Returns a JSON array string with all backup files info.
        /// </summary>
        public string GetBackupsJson()
        {
            try
            {
                DirectoryInfo di = new DirectoryInfo(_backupsDir);
                FileInfo[] files = di.GetFiles("backup_rede_*.reg");
                Array.Sort(files, (a, b) => b.LastWriteTime.CompareTo(a.LastWriteTime));

                var items = new BackupInfo[files.Length];
                for (int i = 0; i < files.Length; i++)
                {
                    var f = files[i];
                    items[i] = new BackupInfo(
                        f.Name,
                        f.LastWriteTime.ToString("dd/MM/yyyy HH:mm"),
                        (f.Length / 1024.0).ToString("N1") + " KB"
                    );
                }

                return JsonSerializer.Serialize(items);
            }
            catch
            {
                return "[]";
            }
        }

        public void RestoreBackup(string backupName)
        {
            try
            {
                string filePath = Path.Combine(_backupsDir, backupName);
                if (File.Exists(filePath))
                {
                    _cmd.Run("reg.exe", "import \"" + filePath + "\"");
                    _sink.Log("logBackupRestored", "success", new { name = backupName });
                }
                else
                {
                    _sink.Log("logBackupNotFound", "error", new { name = backupName });
                }
            }
            catch (Exception ex)
            {
                _sink.Log("logRestoreFailed", "error", new { message = ex.Message });
            }
        }
    }
}
