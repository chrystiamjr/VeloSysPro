using System;
using System.IO;
using System.Text;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// IStatusSink for headless (CLI/scheduled) runs: writes to a log file instead of
    /// the WebView. No translation is available here, so keyed messages are logged as
    /// their key plus args; raw command output is logged verbatim.
    /// </summary>
    public class FileStatusSink : IStatusSink
    {
        private readonly string _logFile;
        private readonly object _lock = new();

        public FileStatusSink(string logFile)
        {
            _logFile = logFile;
        }

        public void Log(string key, string type, object? args = null)
        {
            string argsText = args != null ? " " + JsonSerializer.Serialize(args) : "";
            Write($"[{type}] {key}{argsText}");
        }

        public void LogRaw(string text, string type)
        {
            Write($"[{type}] {text}");
        }

        public void Status(string key, int percent, object? args = null)
        {
            Write($"[status {percent,3}%] {key}");
        }

        private void Write(string message)
        {
            try
            {
                string line = "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message;
                lock (_lock)
                {
                    File.AppendAllText(_logFile, line + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch { }
        }
    }
}
