using System;
using System.Globalization;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class SnapshotManagerTests
{
    private const string Metrics =
        "{\"bootDurationMs\":21345,\"freeMemoryBytes\":8589934592,\"totalMemoryBytes\":17179869184,"
        + "\"freeDiskBytes\":120000000000,\"totalDiskBytes\":500000000000,\"automaticServices\":94,"
        + "\"runningServices\":71,\"startupApps\":13,\"pendingReboot\":true}";

    [Fact]
    public void Capture_ReadsEveryMetricFromTheBuiltInQuery()
    {
        var runner = new FakeCommandRunner { CapturedOutput = Metrics };

        OptimizationSnapshot snapshot = new SnapshotManager(runner, new RecordingStatusSink()).Capture();

        Assert.Equal(21345, snapshot.BootDurationMs);
        Assert.Equal(8589934592, snapshot.FreeMemoryBytes);
        Assert.Equal(17179869184, snapshot.TotalMemoryBytes);
        Assert.Equal(120000000000, snapshot.FreeDiskBytes);
        Assert.Equal(500000000000, snapshot.TotalDiskBytes);
        Assert.Equal(94, snapshot.AutomaticServices);
        Assert.Equal(71, snapshot.RunningServices);
        Assert.Equal(13, snapshot.StartupApps);
        Assert.True(snapshot.PendingReboot);
    }

    [Fact]
    public void Capture_TimestampsTheSnapshotAsRoundTrippableUtc()
    {
        var runner = new FakeCommandRunner { CapturedOutput = Metrics };

        string capturedAt = new SnapshotManager(runner, new RecordingStatusSink()).Capture().CapturedAt;

        Assert.True(
            DateTime.TryParse(
                capturedAt,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out DateTime parsed
            ),
            "CapturedAt must round-trip as ISO 8601: " + capturedAt
        );
        Assert.Equal(DateTimeKind.Utc, parsed.Kind);
    }

    [Fact]
    public void Capture_QueriesLocaleNeutralSourcesOnly()
    {
        var runner = new FakeCommandRunner { CapturedOutput = Metrics };

        new SnapshotManager(runner, new RecordingStatusSink()).Capture();

        var (exe, args) = Assert.Single(runner.Runs);
        Assert.Equal("powershell.exe", exe);
        // .NET enums, not the WMI/CIM display strings Windows translates.
        Assert.Contains("[string]$_.StartType -eq 'Automatic'", args);
        Assert.Contains("[string]$_.Status -eq 'Running'", args);
        Assert.Contains("Get-CimInstance Win32_OperatingSystem", args);
        Assert.Contains("ConvertTo-Json -Compress", args);
        // The whole script travels inside one -Command "..." pair.
        Assert.Equal(2, args.Count(character => character == '"'));
    }

    [Fact]
    public void Capture_DegradesToZeroedMetricsWhenTheQueryFails()
    {
        // A Snapshot that throws would take the whole batch down with it; the diff is a nicety,
        // the optimization is not.
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };

        OptimizationSnapshot snapshot = new SnapshotManager(runner, new RecordingStatusSink()).Capture();

        Assert.Equal(0, snapshot.BootDurationMs);
        Assert.Equal(0, snapshot.FreeMemoryBytes);
        Assert.False(snapshot.PendingReboot);
        Assert.NotEqual("", snapshot.CapturedAt);
    }

    [Fact]
    public void Capture_DegradesToZeroedMetricsWhenTheOutputIsNotJson()
    {
        var runner = new FakeCommandRunner { CapturedOutput = "Get-WinEvent : No events were found" };

        OptimizationSnapshot snapshot = new SnapshotManager(runner, new RecordingStatusSink()).Capture();

        Assert.Equal(0, snapshot.TotalMemoryBytes);
        Assert.Equal(0, snapshot.RunningServices);
    }
}
