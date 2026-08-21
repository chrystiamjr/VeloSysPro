using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;

namespace VeloSysPro
{
    /// <summary>
    /// Append-only JSONL implementation of <see cref="ISnapshotStore"/>: one JSON object per line
    /// in %LOCALAPPDATA%\VeloSysPro\history.jsonl.
    /// </summary>
    /// <remarks>
    /// Appending a line is atomic enough for a single-user desktop app and keeps the file readable
    /// with any text editor. Reading is deliberately defensive: a process killed mid-append leaves
    /// a truncated last line, and losing the whole history to one bad line would be far worse than
    /// losing that line (same reasoning as <see cref="SettingsManager"/>'s swallowed parse).
    /// </remarks>
    public sealed class JsonlSnapshotStore : ISnapshotStore
    {
        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };

        private readonly object _writeLock = new();
        private readonly string _file;

        public JsonlSnapshotStore(string? historyFile = null)
        {
            _file = string.IsNullOrWhiteSpace(historyFile) ? AppPaths.HistoryFile : historyFile;
        }

        public void Append(OptimizationSnapshot snapshot)
        {
            string? parent = Path.GetDirectoryName(_file);
            if (!string.IsNullOrEmpty(parent)) Directory.CreateDirectory(parent);

            string line = JsonSerializer.Serialize(snapshot, Options) + Environment.NewLine;

            // captureSnapshot is a read Action, so it is not serialized by the host's mutation lock
            // and can land while a batch is appending its own before/after pair. Two concurrent
            // AppendAllText calls would collide on the file handle.
            lock (_writeLock) File.AppendAllText(_file, line, Encoding.UTF8);
        }

        public IReadOnlyList<OptimizationSnapshot> ReadAll()
        {
            var snapshots = new List<OptimizationSnapshot>();
            if (!File.Exists(_file)) return snapshots;

            string[] lines;
            try
            {
                lines = File.ReadAllLines(_file, Encoding.UTF8);
            }
            catch
            {
                return snapshots;
            }

            foreach (string line in lines)
            {
                if (line.Trim().Length == 0) continue;
                try
                {
                    OptimizationSnapshot? snapshot =
                        JsonSerializer.Deserialize<OptimizationSnapshot>(line, Options);
                    if (snapshot != null) snapshots.Add(snapshot);
                }
                catch
                {
                    // A damaged line is skipped, never fatal: the rest of the series still loads.
                }
            }

            return snapshots;
        }
    }
}
