using System;
using System.IO;
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
