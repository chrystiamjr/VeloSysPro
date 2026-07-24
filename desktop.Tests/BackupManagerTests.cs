using System;
using System.IO;
using Xunit;

namespace VeloSysPro.Tests;

public class BackupManagerTests
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
        var manager = new BackupManager(temp.Path, new FakeCommandRunner(), new RecordingStatusSink());

        string json = manager.GetBackupsJson();

        Assert.True(json.IndexOf("backup_rede_newer.reg") < json.IndexOf("backup_rede_older.reg"));
    }

    [Fact]
    public void RestoreBackup_ImportsAnExistingBackup()
    {
        using var temp = new TemporaryDirectory();
        File.WriteAllText(Path.Combine(temp.Path, "backup_rede_test.reg"), "registry");
        var runner = new FakeCommandRunner();
        var manager = new BackupManager(temp.Path, runner, new RecordingStatusSink());

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
        var manager = new BackupManager(temp.Path, runner, sink);

        manager.RestoreBackup("missing.reg");

        Assert.Empty(runner.Runs);
        Assert.Contains(sink.Logs, log => log.Key == "log.backup.notFound" && log.Type == "error");
    }

    [Fact]
    public void GetRestorePointsJson_NormalizesASingleObjectToAnArray()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner
        {
            CapturedOutput = """{"Sequence":12,"Date":"24/07/2026","Description":"VeloSysPro"}""",
        };
        var manager = new BackupManager(temp.Path, runner, new RecordingStatusSink());

        Assert.Equal(
            """[{"Sequence":12,"Date":"24/07/2026","Description":"VeloSysPro"}]""",
            manager.GetRestorePointsJson()
        );
    }

    [Fact]
    public void RestoreToPoint_RejectsASequenceWithoutDigits()
    {
        using var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        var sink = new RecordingStatusSink();
        var manager = new BackupManager(temp.Path, runner, sink);

        manager.RestoreToPoint("invalid");

        Assert.Empty(runner.Runs);
        Assert.Contains(sink.Logs, log => log.Key == "log.restoreToPoint.failed");
    }
}
