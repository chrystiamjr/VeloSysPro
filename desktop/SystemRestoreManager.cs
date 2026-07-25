using System;
using System.Linq;

namespace VeloSysPro
{
    /// <summary>Owns Windows System Restore Point creation, listing, and restoration.</summary>
    public sealed class SystemRestoreManager
    {
        private readonly ICommandRunner _cmd;
        private readonly IStatusSink _sink;

        public SystemRestoreManager(ICommandRunner cmd, IStatusSink sink)
        {
            _cmd = cmd;
            _sink = sink;
        }

        public void CreateRestorePoint()
        {
            _sink.Status("status.restorePoint.creating", 20);
            _sink.Log("log.restorePoint.creating", "info");
            string description = "VeloSysPro_" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
            CommandResult result = _cmd.Run(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"Checkpoint-Computer -Description '"
                    + description
                    + "' -RestorePointType 'MODIFY_SETTINGS'\""
            );
            if (!result.Success) throw new InvalidOperationException("Restore point creation failed.");
            _sink.Status("status.restorePoint.done", 100);
            _sink.Log("log.restorePoint.done", "success");
        }

        public string GetRestorePointsJson()
        {
            const string ps =
                "Get-ComputerRestorePoint | ForEach-Object { [PSCustomObject]@{ "
                + "Sequence = $_.SequenceNumber; "
                + "CreatedAt = $_.ConvertToDateTime($_.CreationTime).ToUniversalTime().ToString('o'); "
                + "Description = $_.Description } } | ConvertTo-Json -Compress";

            CaptureResult query = _cmd.RunCapture(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"" + ps + "\""
            );
            if (!query.Success) throw new InvalidOperationException("Restore point query failed.");
            string raw = query.Output.Trim();
            if (string.IsNullOrEmpty(raw)) return "[]";
            return raw.StartsWith("[") ? raw : "[" + raw + "]";
        }

        public void RestoreToPoint(string sequence)
        {
            string digits = new(sequence.Where(char.IsDigit).ToArray());
            if (digits.Length == 0) throw new ArgumentException("Invalid restore point sequence.");

            _sink.Log("log.restoreToPoint.start", "info", new { sequence = digits });
            CommandResult result = _cmd.Run(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"Restore-Computer -RestorePoint " + digits + "\""
            );
            if (!result.Success) throw new InvalidOperationException("System restore failed.");
            _sink.Log("log.restoreToPoint.done", "success", new { sequence = digits });
        }
    }
}
