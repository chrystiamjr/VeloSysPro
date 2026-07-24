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

        scheduler.CreateTask("""{"type":"gaming","frequency":"WEEKLY","time":"04:45","day":"MON"}""");

        var command = Assert.Single(runner.Runs);
        Assert.Equal("schtasks.exe", command.Exe);
        Assert.Contains(@"/tn ""VeloSysPro_Gaming_Weekly_MON_0445""", command.Args);
        Assert.Contains(@"/sc WEEKLY /d MON /st 04:45", command.Args);
        Assert.Contains(@"--task=gaming", command.Args);
        Assert.Contains(sink.Logs, log => log.Key == "log.task.created" && log.Type == "success");
    }

    [Fact]
    public void CreateTask_EncodesDailyScheduleWithoutADayComponent()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"quick","frequency":"DAILY","time":"03:00","day":"MON"}""");

        var args = Assert.Single(runner.Runs).Args;
        Assert.Contains(@"/tn ""VeloSysPro_Quick_Daily_0300""", args);
        Assert.Contains("/sc DAILY /st 03:00", args);
        Assert.DoesNotContain("/d ", args);
    }

    [Fact]
    public void CreateTask_EncodesTheDayOfMonthForMonthlySchedules()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"full","frequency":"MONTHLY","time":"02:00","day":"15"}""");

        var args = Assert.Single(runner.Runs).Args;
        Assert.Contains(@"/tn ""VeloSysPro_Full_Monthly_15_0200""", args);
        Assert.Contains("/sc MONTHLY /d 15 /st 02:00", args);
    }

    [Fact]
    public void CreateTask_KeepsDistinctNamesForTheSameOptimizationAtDifferentTimes()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"quick","frequency":"DAILY","time":"03:00"}""");
        scheduler.CreateTask("""{"type":"quick","frequency":"DAILY","time":"05:00"}""");

        Assert.Contains(@"/tn ""VeloSysPro_Quick_Daily_0300""", runner.Runs[0].Args);
        Assert.Contains(@"/tn ""VeloSysPro_Quick_Daily_0500""", runner.Runs[1].Args);
    }

    [Fact]
    public void CreateTask_FallsBackToDailyForUnknownFrequency()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"quick","frequency":"YEARLY","time":"03:00"}""");

        Assert.Contains("/sc DAILY", Assert.Single(runner.Runs).Args);
    }

    [Theory]
    [InlineData(@"{""type"":""quick"",""frequency"":""WEEKLY"",""time"":""03:00"",""day"":""XYZ""}", @"/d MON")]
    [InlineData(@"{""type"":""quick"",""frequency"":""MONTHLY"",""time"":""03:00"",""day"":""99""}", @"/d 1 ")]
    public void CreateTask_RejectsOutOfRangeDays(string payload, string expected)
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask(payload);

        Assert.Contains(expected, Assert.Single(runner.Runs).Args);
    }

    [Fact]
    public void CreateTask_RejectsUnknownTypesAndMalformedTimes()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.CreateTask("""{"type":"rm -rf","frequency":"DAILY","time":"99:99"}""");

        var args = Assert.Single(runner.Runs).Args;
        Assert.Contains(@"/tn ""VeloSysPro_Quick_Daily_0300""", args);
        Assert.Contains("--task=quick", args);
        Assert.DoesNotContain("rm -rf", args);
    }

    [Fact]
    public void GetTasksJson_ReturnsThePowerShellArrayVerbatim()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput =
                """[{"Name":"VeloSysPro_Quick_Daily_0300","State":"Ready","Path":"\\VeloSysPro_Quick_Daily_0300"}]""",
        };
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        string json = scheduler.GetTasksJson();

        Assert.Contains("VeloSysPro_Quick_Daily_0300", json);
        Assert.Contains(@"""State"":""Ready""", json);
        Assert.StartsWith("[", json);
    }

    [Fact]
    public void GetTasksJson_WrapsTheSingleObjectConvertToJsonEmits()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput =
                """{"Name":"VeloSysPro_Quick_Daily_0300","State":"Ready","Path":"\\VeloSysPro_Quick_Daily_0300"}""",
        };
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        string json = scheduler.GetTasksJson();

        Assert.StartsWith("[", json);
        Assert.EndsWith("]", json);
        Assert.Contains("VeloSysPro_Quick_Daily_0300", json);
    }

    [Fact]
    public void GetTasksJson_FallsBackToSchtasksCsvWhenPowerShellYieldsNothing()
    {
        var runner = new FakeCommandRunner
        {
            CapturedOutput =
                "\"\\VeloSysPro_Quick_Daily_0300\",\"N/A\",\"Ready\"\n"
                + "\"\\Unrelated\",\"N/A\",\"Ready\"\n"
                + "\"\\VeloSysPro_Gaming_Weekly_MON_0430\",\"N/A\",\"Running\"",
        };
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        string json = scheduler.GetTasksJson();

        Assert.Contains("VeloSysPro_Quick_Daily_0300", json);
        Assert.Contains("VeloSysPro_Gaming_Weekly_MON_0430", json);
        Assert.DoesNotContain("Unrelated", json);
    }

    [Fact]
    public void DeleteTask_UsesTheSelectedTaskName()
    {
        var runner = new FakeCommandRunner();
        var scheduler = new SchedulerManager(runner, new RecordingStatusSink(), "VeloSysPro.exe");

        scheduler.DeleteTask("VeloSysPro_Quick_Daily_0300");

        Assert.Equal(
            ("schtasks.exe", @"/delete /tn ""VeloSysPro_Quick_Daily_0300"" /f"),
            Assert.Single(runner.Runs)
        );
    }

    [Theory]
    [InlineData(@"VeloSysPro_Quick"" /f & del C:\")]
    [InlineData("SomeOtherTask")]
    [InlineData("")]
    public void DeleteTask_RefusesNamesOutsideTheVeloSysProNamespace(string name)
    {
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var scheduler = new SchedulerManager(runner, sink, "VeloSysPro.exe");

        scheduler.DeleteTask(name);

        Assert.Empty(runner.Runs);
        Assert.Contains(sink.Logs, log => log.Key == "log.task.failed" && log.Type == "error");
    }
}
