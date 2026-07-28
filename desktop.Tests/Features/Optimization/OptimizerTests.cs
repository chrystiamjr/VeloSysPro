using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class OptimizerTests
{
    [Fact]
    public void RunQuick_ExecutesExpectedCommandsAndCompletes()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var backup = new RegistryBackupManager(temp.Path, runner, sink);
        var optimizer = new Optimizer(runner, backup, sink)
        {
            CreateSafetyBackupEnabled = false,
        };

        Assert.True(optimizer.Execute(OptimizationPlan.Quick));

        Assert.Equal(new[] { "ipconfig.exe", "cleanmgr.exe" }, runner.Runs.Select(run => run.Exe));
        Assert.Equal(1, runner.TempCleanCount);
        Assert.Contains(sink.Statuses, status => status.Key == "status.quick.done" && status.Percent == 100);
        Assert.Contains(sink.Logs, log => log.Key == "log.quick.done" && log.Type == "success");
    }

    [Fact]
    public void RunQuick_ReportsCompletionWithErrorsForAFailedCommand()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner { Result = new CommandResult(1, false) };
        var sink = new RecordingStatusSink();
        var optimizer = new Optimizer(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink),
            sink
        )
        {
            CreateSafetyBackupEnabled = false,
        };

        Assert.False(optimizer.Execute(OptimizationPlan.Quick));

        Assert.Contains(
            sink.Logs,
            log => log.Key == "log.op.completedWithErrors" && log.Type == "error"
        );
    }

    [Fact]
    public void RunByName_NoLongerOwnsGaming()
    {
        // "gaming" is a Tweak Preset now, not an Optimization Plan: it used to write TCP globals
        // through netsh with no capture and no undo. App.RunHeadless resolves Presets first, so
        // --task=gaming keeps working; this guards the Optimizer from quietly claiming it back.
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var optimizer = new Optimizer(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink),
            sink
        );

        Assert.False(optimizer.RunByName("gaming"));
        Assert.Empty(runner.Runs);
    }

    [Theory]
    [InlineData("quick")]
    [InlineData("full")]
    [InlineData("revert")]
    public void RunByName_AcceptsEverySupportedHeadlessTask(string task)
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var optimizer = new Optimizer(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink),
            sink
        )
        {
            CreateSafetyBackupEnabled = false,
        };

        Assert.True(optimizer.RunByName(task));
    }

    [Fact]
    public void RunByName_RejectsUnknownTasks()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var optimizer = new Optimizer(
            runner,
            new RegistryBackupManager(temp.Path, runner, sink),
            sink
        );

        Assert.False(optimizer.RunByName("unknown"));
        Assert.Empty(runner.Runs);
    }
}
