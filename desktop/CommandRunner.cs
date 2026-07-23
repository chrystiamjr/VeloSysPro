using System;
using System.Diagnostics;
using System.IO;

namespace VeloSysPro
{
    /// <summary>
    /// Executes system commands (ipconfig, sfc, dism, netsh, cleanmgr, etc.)
    /// and streams stdout/stderr to the status sink as raw (untranslatable) text.
    /// </summary>
    public class CommandRunner
    {
        private readonly IStatusSink _sink;

        public CommandRunner(IStatusSink sink)
        {
            _sink = sink;
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

                        if (!string.IsNullOrWhiteSpace(stdout)) _sink.LogRaw(stdout.Trim(), "info");
                        if (!string.IsNullOrWhiteSpace(stderr)) _sink.LogRaw(stderr.Trim(), "error");
                    }
                }
            }
            catch (Exception ex)
            {
                _sink.Log("logCmdError", "error", new { exe, message = ex.Message });
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
