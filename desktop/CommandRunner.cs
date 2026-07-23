using System;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace VeloSysPro
{
    /// <summary>
    /// Executes system commands (ipconfig, sfc, dism, netsh, cleanmgr, etc.)
    /// and captures stdout/stderr output.
    /// </summary>
    public class CommandRunner
    {
        private readonly Action<string, string> _log;
        private readonly Action<string> _logError;

        public CommandRunner(Action<string, string> log, Action<string> logError)
        {
            _log = log;
            _logError = logError;
        }

        public void Run(string exe, string args)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = args,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                using (Process? proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        string stdout = proc.StandardOutput.ReadToEnd();
                        string stderr = proc.StandardError.ReadToEnd();
                        proc.WaitForExit();

                        if (!string.IsNullOrWhiteSpace(stdout)) _log(stdout.Trim(), "info");
                        if (!string.IsNullOrWhiteSpace(stderr)) _logError(stderr.Trim());
                    }
                }
            }
            catch (Exception ex)
            {
                _logError("Erro executando " + exe + ": " + ex.Message);
            }
        }

        public void CleanTempFolder()
        {
            try
            {
                string tempDir = Path.GetTempPath();
                DirectoryInfo di = new DirectoryInfo(tempDir);
                foreach (FileInfo file in di.GetFiles())
                {
                    try { file.Delete(); } catch { }
                }
                foreach (DirectoryInfo dir in di.GetDirectories())
                {
                    try { dir.Delete(true); } catch { }
                }
            }
            catch { }
        }
    }
}
