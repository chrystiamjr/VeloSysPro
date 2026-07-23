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
        private readonly Action<string, string> _log;
        private readonly Action<string> _logError;

        public BackupManager(string backupsDir, CommandRunner cmd, Action<string, string> log, Action<string> logError)
        {
            _backupsDir = backupsDir;
            _cmd = cmd;
            _log = log;
            _logError = logError;

            Directory.CreateDirectory(_backupsDir);
        }

        public void CreateBackup()
        {
            try
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
                string file = Path.Combine(_backupsDir, "backup_rede_" + timestamp + ".reg");
                _cmd.Run("reg.exe", "export \"HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\" \"" + file + "\" /y");
                _log("Backup do registro criado: " + file, "success");
            }
            catch (Exception ex)
            {
                _logError("Falha ao criar backup: " + ex.Message);
            }
        }

        public void CreateRestorePoint(Action<string, int> updateStatus)
        {
            updateStatus("Criando Ponto de Restauração...", 20);
            _log("Criando Ponto de Restauração do Sistema...", "info");
            try
            {
                string psCmd = "Checkpoint-Computer -Description 'VeloSysPro_" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss") + "' -RestorePointType 'MODIFY_SETTINGS'";
                _cmd.Run("powershell.exe", "-ExecutionPolicy Bypass -Command \"" + psCmd + "\"");
                updateStatus("Ponto de restauração criado!", 100);
                _log("Ponto de Restauração criado com sucesso.", "success");
            }
            catch (Exception ex)
            {
                _logError("Falha ao criar ponto de restauração: " + ex.Message);
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
                    _log("Backup restaurado: " + backupName, "success");
                }
                else
                {
                    _logError("Arquivo de backup não encontrado: " + backupName);
                }
            }
            catch (Exception ex)
            {
                _logError("Falha ao restaurar backup: " + ex.Message);
            }
        }
    }
}
