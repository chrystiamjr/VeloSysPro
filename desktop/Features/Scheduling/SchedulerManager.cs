using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>
    /// Manages Windows Task Scheduler entries that run VeloSys Pro optimizations
    /// headlessly (VeloSysPro.exe --task=&lt;type&gt;) via schtasks.exe.
    /// </summary>
    /// <remarks>
    /// Task names encode the whole schedule (VeloSysPro_Quick_Daily_0300,
    /// VeloSysPro_Gaming_Weekly_MON_0430, VeloSysPro_Full_Monthly_15_0200). That keeps names
    /// unique so several schedules of the same optimization can coexist, makes re-creating an
    /// identical schedule idempotent, and lets the UI describe a task without a sidecar index
    /// that could drift from the Windows Task Scheduler.
    /// </remarks>
    public class SchedulerManager
    {
        /// <summary>Serializable shape matching ScheduledTaskItem in the React frontend.</summary>
        private record TaskInfo(
            string Name,
            string State,
            string Path,
            string Type,
            string Frequency,
            string Day,
            string Time
        );

        private const string Prefix = "VeloSysPro_";

        private static readonly Regex TaskNamePattern =
            new(@"^VeloSysPro_[A-Za-z0-9_]+$", RegexOptions.Compiled);

        private readonly ICommandRunner _cmd;
        private readonly IStatusSink _sink;
        private readonly string _exePath;

        public SchedulerManager(ICommandRunner cmd, IStatusSink sink, string? exePath = null)
        {
            _cmd = cmd;
            _sink = sink;
            _exePath = exePath ?? Process.GetCurrentProcess().MainModule?.FileName ?? "";
        }

        /// <summary>
        /// Creates a scheduled task from a JSON payload: {type, frequency, time, day}.
        /// `day` is a weekday token (MON..SUN) for WEEKLY and a day of month (1..31) for MONTHLY;
        /// it is ignored for DAILY.
        /// </summary>
        public void CreateTask(string payloadJson)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(payloadJson);
                JsonElement root = doc.RootElement;

                ScheduleSpec schedule = SchedulePolicy.Normalize(
                    GetString(root, "type", "quick"),
                    GetString(root, "frequency", "DAILY"),
                    GetString(root, "day", ""),
                    GetString(root, "time", "03:00")
                );

                CreateTask(schedule);
            }
            catch (Exception ex)
            {
                _sink.Log("log.task.failed", "error", new { message = ex.Message });
            }
        }

        /// <summary>Returns VeloSys Pro scheduled tasks as JSON [{Name, State, Path}].</summary>
        /// <remarks>
        /// Prefers Get-ScheduledTask because its State is a .NET enum (Ready/Running/Disabled),
        /// while `schtasks /query` prints a status translated to the Windows display language and
        /// therefore cannot be mapped to a UI badge. Falls back to the CSV parser when PowerShell
        /// is unavailable so the list never disappears.
        /// </remarks>
        public string GetTasksJson()
        {
            try
            {
                const string ps =
                    "Get-ScheduledTask -TaskPath '\\' | "
                    + "Where-Object { $_.TaskName -like 'VeloSysPro_*' } | "
                    + "ForEach-Object { [PSCustomObject]@{ "
                    + "Name = $_.TaskName; "
                    + "State = [string]$_.State; "
                    + "Path = $_.TaskPath + $_.TaskName } } | ConvertTo-Json -Compress";

                CaptureResult query = _cmd.RunCapture(
                    "powershell.exe",
                    "-ExecutionPolicy Bypass -Command \"" + ps + "\""
                );
                string raw = query.Success ? query.Output.Trim() : "";

                if (raw.StartsWith("[", StringComparison.Ordinal))
                    return EnrichTaskJson(raw);
                if (raw.StartsWith("{", StringComparison.Ordinal))
                    return EnrichTaskJson("[" + raw + "]");
            }
            catch
            {
                // Fall through to the schtasks fallback below.
            }

            return GetTasksJsonFromSchtasks();
        }

        /// <summary>Legacy listing path used when the PowerShell query yields nothing.</summary>
        private string GetTasksJsonFromSchtasks()
        {
            try
            {
                CaptureResult query = _cmd.RunCapture("schtasks.exe", "/query /fo CSV /nh");
                if (!query.Success) throw new InvalidOperationException("Task query failed.");
                string csv = query.Output;
                var list = new List<TaskInfo>();

                foreach (string rawLine in csv.Split('\n'))
                {
                    string line = rawLine.Trim();
                    if (line.Length == 0) continue;

                    List<string> cols = ParseCsvLine(line);
                    if (cols.Count < 3) continue;

                    string fullPath = cols[0];
                    string name = fullPath.TrimStart('\\');
                    if (!name.StartsWith(Prefix, StringComparison.Ordinal)) continue;

                    list.Add(CreateTaskInfo(name, cols[2], fullPath));
                }

                return JsonSerializer.Serialize(list);
            }
            catch
            {
                return "[]";
            }
        }

        public void DeleteTask(string name)
        {
            // The name reaches a command line, so only accept the shape this app creates.
            if (string.IsNullOrEmpty(name) || !TaskNamePattern.IsMatch(name))
            {
                throw new ArgumentException("Invalid task name.");
            }

            CommandResult result = _cmd.Run("schtasks.exe", $"/delete /tn \"{name}\" /f");
            if (!result.Success) throw new InvalidOperationException("Task deletion failed.");
            _sink.Log("log.task.deleted", "success", new { name });
        }

        private static string GetString(JsonElement root, string prop, string fallback)
        {
            return root.TryGetProperty(prop, out JsonElement el) && el.ValueKind == JsonValueKind.String
                ? el.GetString() ?? fallback
                : fallback;
        }

        private static string EnrichTaskJson(string raw)
        {
            using JsonDocument document = JsonDocument.Parse(raw);
            var tasks = new List<TaskInfo>();
            foreach (JsonElement item in document.RootElement.EnumerateArray())
            {
                string name = GetString(item, "Name", "");
                if (!name.StartsWith(Prefix, StringComparison.Ordinal)) continue;
                tasks.Add(
                    CreateTaskInfo(
                        name,
                        GetString(item, "State", ""),
                        GetString(item, "Path", "")
                    )
                );
            }
            return JsonSerializer.Serialize(tasks);
        }

        public void CreateTask(ScheduleSpec schedule)
        {
            string taskName = SchedulePolicy.EncodeName(schedule);
            string args = SchedulePolicy.BuildSchtasksCreateArgs(schedule, _exePath);
            CommandResult result = _cmd.Run("schtasks.exe", args);
            if (!result.Success) throw new InvalidOperationException("Task creation failed.");
            _sink.Log("log.task.created", "success", new { name = taskName });
        }

        private static TaskInfo CreateTaskInfo(string name, string state, string path)
        {
            ScheduleSpec? schedule = SchedulePolicy.DecodeName(name);
            return new TaskInfo(
                name,
                NormalizeTaskState(state),
                path,
                schedule?.Type ?? "",
                schedule?.Frequency ?? "",
                schedule?.Day ?? "",
                schedule?.Time ?? ""
            );
        }

        private static string NormalizeTaskState(string state)
        {
            string normalized = state.Trim();
            return normalized is "Ready" or "Running" or "Queued" or "Disabled"
                ? normalized
                : "Unknown";
        }

        /// <summary>Minimal CSV line parser handling double-quoted fields.</summary>
        private static List<string> ParseCsvLine(string line)
        {
            var result = new List<string>();
            var sb = new StringBuilder();
            bool inQuotes = false;

            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        sb.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    result.Add(sb.ToString());
                    sb.Clear();
                }
                else
                {
                    sb.Append(c);
                }
            }
            result.Add(sb.ToString());
            return result;
        }
    }
}
