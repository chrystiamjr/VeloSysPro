using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class SchedulerManagerTests
{
    [Fact]
    public void CreateTask_MapsPayloadToSafeSchtasksArguments()
    {
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var scheduler = new SchedulerManager(runner, sink, @"C:\Apps\VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"gaming","frequency":"WEEKLY","time":"04:45"}""");

        var command = Assert.Single(runner.Runs);
        Assert.Equal("schtasks.exe", command.Exe);
        Assert.Contains(@"/tn ""VeloSysPro_Gaming""", command.Args);
        Assert.Contains(@"/sc WEEKLY /st 04:45", command.Args);
        Assert.Contains(@"--task=gaming", command.Args);
        Assert.Contains(sink.Logs, log => log.Key == "log.task.created" && log.Type == "success");
    }

    [Fact]
    public void CreateTask_FallsBackToDailyForUnknownFrequency()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"quick","frequency":"YEARLY","time":"03:00"}""");

        Assert.Contains("/sc DAILY", Assert.Single(runner.Runs).Args);
    }

    [Fact]
    public void GetTasksJson_FiltersUnrelatedTasksAndParsesQuotedCsv()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput =
                "\"\\VeloSysPro_Quick\",\"N/A\",\"Ready\"\n"
                + "\"\\Unrelated\",\"N/A\",\"Ready\"\n"
                + "\"\\VeloSysPro_Gaming\",\"N/A\",\"Running\"",
        };
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        string json = scheduler.GetTasksJson();

        Assert.Contains("VeloSysPro_Quick", json);
        Assert.Contains("VeloSysPro_Gaming", json);
        Assert.DoesNotContain("Unrelated", json);
    }

    [Fact]
    public void DeleteTask_UsesTheSelectedTaskName()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.DeleteTask("VeloSysPro_Quick");

        Assert.Equal(
            ("schtasks.exe", @"/delete /tn ""VeloSysPro_Quick"" /f"),
            Assert.Single(runner.Runs)
        );
    }
}
