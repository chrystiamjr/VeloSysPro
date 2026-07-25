using System;
using System.Collections.Generic;

namespace VeloSysPro.Tests;

internal sealed class FakeCommandRunner : ICommandRunner
{
    public List<(string Exe, string Args)> Runs { get; } = new();
    public List<string> ClearedDirectories { get; } = new();
    public string CapturedOutput { get; set; } = "";

    /// <summary>
    /// Per-executable RunCapture output, keyed by exe name. Lets a test drive a manager that
    /// queries more than one tool (e.g. powershell.exe with a schtasks.exe fallback) without
    /// both calls receiving the same canned string. Falls back to <see cref="CapturedOutput"/>.
    /// </summary>
    public Dictionary<string, string> CapturedOutputs { get; } = new(StringComparer.OrdinalIgnoreCase);

    public CommandResult Result { get; set; } = new(0, true);
    public int TempCleanCount { get; private set; }

    public CommandResult Run(string exe, string args)
    {
        Runs.Add((exe, args));
        return Result;
    }

    public string RunCapture(string exe, string args)
    {
        Runs.Add((exe, args));
        return CapturedOutputs.TryGetValue(exe, out string? output) ? output : CapturedOutput;
    }

    public void CleanTempFolder() => TempCleanCount++;

    public void ClearDirectory(string path) => ClearedDirectories.Add(path);
}

internal sealed class RecordingStatusSink : IStatusSink
{
    public List<(string Key, string Type, object? Args)> Logs { get; } = new();
    public List<(string Key, int Percent, object? Args)> Statuses { get; } = new();
    public List<(string Text, string Type)> RawLogs { get; } = new();

    public void Log(string key, string type, object? args = null) => Logs.Add((key, type, args));

    public void LogRaw(string text, string type) => RawLogs.Add((text, type));

    public void Status(string key, int percent, object? args = null) =>
        Statuses.Add((key, percent, args));
}

internal sealed class TemporaryDirectory : IDisposable
{
    public string Path { get; } = System.IO.Path.Combine(
        System.IO.Path.GetTempPath(),
        "VeloSysPro.Tests",
        Guid.NewGuid().ToString("N")
    );

    public TemporaryDirectory() => System.IO.Directory.CreateDirectory(Path);

    public void Dispose()
    {
        if (System.IO.Directory.Exists(Path))
            System.IO.Directory.Delete(Path, recursive: true);
    }
}
