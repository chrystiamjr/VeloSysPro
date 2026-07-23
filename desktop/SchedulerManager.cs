using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Manages Windows Task Scheduler entries that run VeloSys Pro optimizations
    /// headlessly (VeloSysPro.exe --task=&lt;type&gt;) via schtasks.exe.
    /// </summary>
    public class SchedulerManager
    {
        /// <summary>Serializable shape matching ScheduledTaskItem in the React frontend.</summary>
        private record TaskInfo(string Name, string State, string Path);

        private const string Prefix = "VeloSysPro_";

        private readonly CommandRunner _cmd;
        private readonly IStatusSink _sink;
        private readonly string _exePath;

        public SchedulerManager(CommandRunner cmd, IStatusSink sink)
        {
            _cmd = cmd;
            _sink = sink;
            _exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "";
        }

        /// <summary>Creates a scheduled task from a JSON payload: {type, frequency, time}.</summary>
        public void CreateTask(string payloadJson)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(payloadJson);
                JsonElement root = doc.RootElement;

                string type = GetString(root, "type", "quick");
                string frequency = GetString(root, "frequency", "DAILY").ToUpperInvariant();
                string time = GetString(root, "time", "03:00");

                if (frequency != "DAILY" && frequency != "WEEKLY" && frequency != "MONTHLY")
                    frequency = "DAILY";

                string taskName = Prefix + Capitalize(type);
                string tr = "\\\"" + _exePath + "\\\" --task=" + type;

                _cmd.Run(
                    "schtasks.exe",
                    $"/create /tn \"{taskName}\" /tr \"{tr}\" /sc {frequency} /st {time} /rl HIGHEST /f"
                );
                _sink.Log("logTaskCreated", "success", new { name = taskName });
            }
            catch (Exception ex)
            {
                _sink.Log("logTaskFailed", "error", new { message = ex.Message });
            }
        }

        /// <summary>Returns VeloSys Pro scheduled tasks as JSON [{Name, State, Path}].</summary>
        public string GetTasksJson()
        {
            try
            {
                string csv = _cmd.RunCapture("schtasks.exe", "/query /fo CSV /nh");
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

                    list.Add(new TaskInfo(name, cols[2], fullPath));
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
            try
            {
                _cmd.Run("schtasks.exe", $"/delete /tn \"{name}\" /f");
                _sink.Log("logTaskDeleted", "success", new { name });
            }
            catch (Exception ex)
            {
                _sink.Log("logTaskFailed", "error", new { message = ex.Message });
            }
        }

        private static string GetString(JsonElement root, string prop, string fallback)
        {
            return root.TryGetProperty(prop, out JsonElement el) && el.ValueKind == JsonValueKind.String
                ? el.GetString() ?? fallback
                : fallback;
        }

        private static string Capitalize(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            return char.ToUpperInvariant(s[0]) + s.Substring(1).ToLowerInvariant();
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
