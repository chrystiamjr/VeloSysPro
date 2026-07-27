using System;
using System.Globalization;
using System.Linq;

namespace VeloSysPro
{
    /// <summary>Owns Windows System Restore Point creation, listing, and restoration.</summary>
    public sealed class SystemRestoreManager
    {
        private const string SystemRestoreKey =
            @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore";

        private readonly ICommandRunner _cmd;
        private readonly IStatusSink _sink;

        public SystemRestoreManager(ICommandRunner cmd, IStatusSink sink)
        {
            _cmd = cmd;
            _sink = sink;
        }

        /// <summary>
        /// Whether Windows System Protection is switched on, which is the precondition for every
        /// restore point this app creates.
        /// </summary>
        /// <remarks>
        /// Read from <c>RPSessionInterval</c>, the documented global switch: 0 or absent means
        /// System Protection is off and <c>Checkpoint-Computer</c> cannot succeed. Knowing this up
        /// front is what lets the app tell the user how to fix it instead of failing a batch with a
        /// generic error they cannot act on.
        /// </remarks>
        public bool IsProtectionEnabled()
        {
            CaptureResult query = _cmd.RunCapture(
                "reg.exe",
                "query \"" + SystemRestoreKey + "\" /v RPSessionInterval"
            );
            if (!query.Success) return false;

            foreach (string rawLine in query.Output.Split('\n'))
            {
                string[] parts = System.Text.RegularExpressions.Regex.Split(rawLine.Trim(), @"\s{2,}|\t+");
                if (parts.Length < 3) continue;
                if (!string.Equals(parts[0], "RPSessionInterval", StringComparison.OrdinalIgnoreCase))
                    continue;

                string data = parts[2].Trim();
                if (data.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
                {
                    return int.TryParse(
                        data.Substring(2),
                        NumberStyles.HexNumber,
                        CultureInfo.InvariantCulture,
                        out int hex
                    ) && hex != 0;
                }

                return int.TryParse(data, NumberStyles.Integer, CultureInfo.InvariantCulture, out int value)
                    && value != 0;
            }

            return false;
        }

        /// <summary>
        /// Turns System Protection on for the system drive and lifts the once-per-day cap on
        /// restore-point creation.
        /// </summary>
        /// <remarks>
        /// The cap matters as much as the switch: with Windows' default of one checkpoint per 24
        /// hours, a second batch on the same day would silently get no restore point of its own,
        /// and this app's promise is a Safety Checkpoint per batch — not per day.
        /// </remarks>
        public void EnableProtection()
        {
            _sink.Log("log.protection.enabling", "info");

            // ($env:SystemDrive + '\') avoids nesting quotes inside the -Command payload.
            CommandResult enable = _cmd.Run(
                "powershell.exe",
                "-ExecutionPolicy Bypass -Command \"Enable-ComputerRestore -Drive ($env:SystemDrive + '\\')\""
            );
            if (!enable.Success)
                throw new InvalidOperationException("Enabling System Protection failed.");

            CommandResult frequency = _cmd.Run(
                "reg.exe",
                "add \"" + SystemRestoreKey + "\" /v SystemRestorePointCreationFrequency /t REG_DWORD /d 0 /f"
            );
            if (!frequency.Success)
                throw new InvalidOperationException("Clearing the restore point frequency cap failed.");

            _sink.Log("log.protection.enabled", "success");
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
