using System;
using System.Collections.Generic;
using System.Threading;

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

    /// <summary>
    /// Per-argument RunCapture output, matched by substring and checked before
    /// <see cref="CapturedOutputs"/>. Needed once a manager queries the same executable for two
    /// different things — reg.exe answers both "is System Protection on" and "what is this Tweak's
    /// value", and one canned string cannot stand in for both.
    /// </summary>
    public List<(string ArgsContains, string Output)> CapturedOutputsByArgs { get; } = new();

    /// <summary>
    /// Substrings of a RunCapture whose query should *fail*, checked before every scripted output.
    /// Without this a scripted answer is always a successful one, and "the machine said nothing"
    /// cannot be told apart from "the query did not run" — which is exactly the distinction a
    /// read-back has to get right.
    /// </summary>
    public List<string> FailingCapturesByArgs { get; } = new();

    public CommandResult Result { get; set; } = new(0, true);
    public int TempCleanCount { get; private set; }

    /// <summary>
    /// Substring of a command that should block until <see cref="ReleaseHeldCommand"/> is called.
    /// Lets a test hold one Action mid-flight and observe what the host does to a second one —
    /// the only way to prove the mutation lock without racing two real runs against each other.
    /// </summary>
    public string? HoldCommandsContaining { get; set; }

    /// <summary>Signalled once a held command has actually been reached.</summary>
    public ManualResetEventSlim HeldCommandReached { get; } = new();

    private readonly ManualResetEventSlim _heldCommandRelease = new();

    public void ReleaseHeldCommand() => _heldCommandRelease.Set();

    public CommandResult Run(string exe, string args)
    {
        Runs.Add((exe, args));

        if (HoldCommandsContaining != null
            && args.Contains(HoldCommandsContaining, StringComparison.OrdinalIgnoreCase))
        {
            HeldCommandReached.Set();
            _heldCommandRelease.Wait(TimeSpan.FromSeconds(10));
        }

        return Result;
    }

    public CaptureResult RunCapture(string exe, string args)
    {
        Runs.Add((exe, args));

        foreach (string failing in FailingCapturesByArgs)
        {
            if (args.Contains(failing, StringComparison.OrdinalIgnoreCase))
                return new CaptureResult("", 1, false);
        }

        foreach ((string ArgsContains, string Output) scripted in CapturedOutputsByArgs)
        {
            if (args.Contains(scripted.ArgsContains, StringComparison.OrdinalIgnoreCase))
                return new CaptureResult(scripted.Output, 0, true);
        }

        string output = CapturedOutputs.TryGetValue(exe, out string? configured)
            ? configured
            : CapturedOutput;
        return new CaptureResult(output, Result.ExitCode, Result.Success);
    }

    public void CleanTempFolder() => TempCleanCount++;

    public void ClearDirectory(string path) => ClearedDirectories.Add(path);
}

/// <summary>
/// Command runner whose RunCapture answers a queued script, so a single test can drive a sequence
/// of different query results (value before the change, value after it) instead of one canned
/// string that would make every step agree with itself.
/// </summary>
internal sealed class ScriptedCommandRunner : ICommandRunner
{
    private readonly Queue<(string Output, bool Success)> _captures = new();

    public List<(string Exe, string Args)> Runs { get; } = new();
    public CommandResult Result { get; set; } = new(0, true);

    /// <summary>Result for a capture that runs out of script (an absent value queries as failure).</summary>
    public CommandResult ExhaustedResult { get; set; } = new(1, false);

    public void EnqueueCapture(string output, bool success = true) =>
        _captures.Enqueue((output, success));

    /// <summary>Queues a query that fails, e.g. a registry value or key that is not there.</summary>
    public void EnqueueFailedCapture() => _captures.Enqueue(("", false));

    public CommandResult Run(string exe, string args)
    {
        Runs.Add((exe, args));
        return Result;
    }

    public CaptureResult RunCapture(string exe, string args)
    {
        Runs.Add((exe, args));
        if (_captures.Count == 0)
            return new CaptureResult("", ExhaustedResult.ExitCode, ExhaustedResult.Success);

        (string Output, bool Success) scripted = _captures.Dequeue();
        return new CaptureResult(scripted.Output, scripted.Success ? 0 : 1, scripted.Success);
    }

    public void CleanTempFolder() { }

    public void ClearDirectory(string path) { }
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
