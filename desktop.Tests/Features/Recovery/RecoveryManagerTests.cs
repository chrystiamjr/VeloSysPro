using System;
using System.IO;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class RecoveryManagerTests
{
    [Fact]
    public void GetBackupsJson_ListsNewestBackupFirst()
    {
        using var temp = new TemporaryDirectory();
        string older = Path.Combine(temp.Path, "backup_rede_older.reg");
        string newer = Path.Combine(temp.Path, "backup_rede_newer.reg");
        File.WriteAllText(older, "old");
        File.WriteAllText(newer, "newer");
        File.SetLastWriteTime(older, new DateTime(2026, 7, 23, 9, 0, 0));
        File.SetLastWriteTime(newer, new DateTime(2026, 7, 24, 10, 0, 0));
        var manager = new RegistryBackupManager(temp.Path, new FakeCommandRunner(), new RecordingStatusSink());

        string json = manager.GetBackupsJson();

        Assert.True(json.IndexOf("backup_rede_newer.reg") < json.IndexOf("backup_rede_older.reg"));
        Assert.Contains(@"""CreatedAt"":", json);
        Assert.Contains(@"""SizeBytes"":5", json);
        Assert.DoesNotContain(@"""Date"":", json);
        Assert.DoesNotContain(@"""Size"":", json);
    }

    [Fact]
    public void RestoreBackup_ImportsAnExistingBackup()
    {
        using var temp = new TemporaryDirectory();
        File.WriteAllText(Path.Combine(temp.Path, "backup_rede_test.reg"), "registry");
        var runner = new FakeCommandRunner();
        var manager = new RegistryBackupManager(temp.Path, runner, new RecordingStatusSink());

        manager.RestoreBackup("backup_rede_test.reg");

        var command = Assert.Single(runner.Runs);
        Assert.Equal("reg.exe", command.Exe);
        Assert.Contains("backup_rede_test.reg", command.Args);
    }

    [Fact]
    public void RestoreBackup_ReportsMissingFilesWithoutRunningACommand()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var manager = new RegistryBackupManager(temp.Path, runner, sink);

        Assert.Throws<ArgumentException>(() => manager.RestoreBackup("missing.reg"));

        Assert.Empty(runner.Runs);
    }

    [Fact]
    public void GetRestorePointsJson_NormalizesASingleObjectToAnArray()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            CapturedOutput =
                """{"Sequence":12,"CreatedAt":"2026-07-24T11:00:00.0000000Z","Description":"VeloSysPro"}""",
        };
        var manager = new SystemRestoreManager(runner, new RecordingStatusSink());

        Assert.Equal(
            """[{"Sequence":12,"CreatedAt":"2026-07-24T11:00:00.0000000Z","Description":"VeloSysPro"}]""",
            manager.GetRestorePointsJson()
        );
        Assert.Contains(
            "ToUniversalTime().ToString('o')",
            Assert.Single(runner.Runs).Args
        );
    }

    [Fact]
    public void CreateRestorePoint_RefusesTheCheckpointWindowsOnlyPretendedToCreate()
    {
        // Checkpoint-Computer writes a warning and exits 0 when the once-per-day cap denies it,
        // so a zero exit code is not evidence of a checkpoint. Reading it back is.
        var runner = new FakeCommandRunner();
        runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "0"));
        var sink = new RecordingStatusSink();
        var manager = new SystemRestoreManager(runner, sink);

        Assert.Throws<InvalidOperationException>(() => manager.CreateRestorePoint());

        Assert.DoesNotContain(sink.Logs, entry => entry.Key == "log.restorePoint.done");
        Assert.Contains(
            sink.Logs,
            entry => entry.Key == "log.restorePoint.unconfirmed" && entry.Type == "error"
        );
    }

    [Fact]
    public void CreateRestorePoint_ReportsSuccessOnlyAfterReadingTheCheckpointBack()
    {
        var runner = new FakeCommandRunner();
        runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "1"));
        var sink = new RecordingStatusSink();
        var manager = new SystemRestoreManager(runner, sink);

        manager.CreateRestorePoint();

        Assert.Contains(
            sink.Logs,
            entry => entry.Key == "log.restorePoint.done" && entry.Type == "success"
        );
        (string Exe, string Args) verification = Assert.Single(
            runner.Runs,
            run => run.Args.Contains("ExpandProperty Count")
        );
        Assert.Equal("powershell.exe", verification.Exe);
    }

    [Fact]
    public void CreateRestorePoint_LiftsTheOncePerDayCapBeforeCheckpointing()
    {
        // A machine whose System Protection was already on never passes through
        // EnableProtection, so without this the second batch of the day gets no checkpoint.
        var runner = new FakeCommandRunner();
        runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "1"));
        var manager = new SystemRestoreManager(runner, new RecordingStatusSink());

        manager.CreateRestorePoint();

        int cap = runner.Runs.FindIndex(run =>
            run.Exe == "reg.exe"
            && run.Args.Contains("SystemRestorePointCreationFrequency")
            && run.Args.Contains("/d 0")
        );
        int checkpoint = runner.Runs.FindIndex(run => run.Args.Contains("Checkpoint-Computer"));

        Assert.True(cap >= 0, "the once-per-day cap was never lifted");
        Assert.True(checkpoint >= 0, "no checkpoint was attempted");
        Assert.True(cap < checkpoint, "the cap must be lifted before the checkpoint is attempted");
    }

    [Fact]
    public void RestoreToPoint_RejectsASequenceWithoutDigits()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var manager = new SystemRestoreManager(runner, sink);

        Assert.Throws<ArgumentException>(() => manager.RestoreToPoint("invalid"));

        Assert.Empty(runner.Runs);
    }
}
