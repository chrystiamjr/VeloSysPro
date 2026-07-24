using System;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace VeloSysPro
{
    /// <summary>
    /// Executes system commands (ipconfig, sfc, dism, netsh, cleanmgr, etc.)
    /// and streams stdout/stderr to the status sink as raw (untranslatable) text.
    /// </summary>
    public class CommandRunner : ICommandRunner
    {
        private readonly IStatusSink _sink;
        private static readonly Encoding WindowsCommandEncoding = NativeConsoleEncoding.ForCommands();

        public CommandRunner(IStatusSink sink)
        {
            _sink = sink;
        }

        /// <summary>
        /// Runs a command, streaming stdout/stderr to the sink, and returns its result.
        /// stderr is logged as 'error' only when the process failed (non-zero exit); many
        /// Windows tools write to stderr on success, so on exit 0 it is logged as 'info'.
        /// </summary>
        public CommandResult Run(string exe, string args)
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
                    RedirectStandardError = true,
                    StandardOutputEncoding = WindowsCommandEncoding,
                    StandardErrorEncoding = WindowsCommandEncoding
                };

                using (Process? proc = Process.Start(psi))
                {
                    if (proc == null) return new CommandResult(-1, false);

                    string stdout = proc.StandardOutput.ReadToEnd();
                    string stderr = proc.StandardError.ReadToEnd();
                    proc.WaitForExit();

                    int exitCode = proc.ExitCode;
                    bool success = exitCode == 0;

                    if (!string.IsNullOrWhiteSpace(stdout)) _sink.LogRaw(stdout.Trim(), "info");
                    if (!string.IsNullOrWhiteSpace(stderr)) _sink.LogRaw(stderr.Trim(), success ? "info" : "error");

                    return new CommandResult(exitCode, success);
                }
            }
            catch (Exception ex)
            {
                _sink.Log("log.cmdError", "error", new { exe, message = ex.Message });
                return new CommandResult(-1, false);
            }
        }

        /// <summary>Runs a command and returns its stdout (used when the output must be parsed).</summary>
        public string RunCapture(string exe, string args)
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
                    RedirectStandardError = true,
                    StandardOutputEncoding = WindowsCommandEncoding,
                    StandardErrorEncoding = WindowsCommandEncoding
                };

                using (Process? proc = Process.Start(psi))
                {
                    if (proc == null) return "";
                    string stdout = proc.StandardOutput.ReadToEnd();
                    proc.StandardError.ReadToEnd();
                    proc.WaitForExit();
                    return stdout;
                }
            }
            catch (Exception ex)
            {
                _sink.Log("log.cmdError", "error", new { exe, message = ex.Message });
                return "";
            }
        }

        public void CleanTempFolder() => ClearDirectory(Path.GetTempPath());

        /// <summary>Best-effort deletion of all files/subfolders inside a directory (locked items skipped).</summary>
        public void ClearDirectory(string path)
        {
            try
            {
                if (!Directory.Exists(path)) return;
                DirectoryInfo di = new DirectoryInfo(path);
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
