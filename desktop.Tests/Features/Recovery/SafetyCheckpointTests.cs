using System;
using System.IO;
using Xunit;

namespace VeloSysPro.Tests;

public class SafetyCheckpointTests : IDisposable
{
    private readonly string _tempDir;
    private readonly FakeCommandRunner _cmd;
    private readonly RecordingStatusSink _sink;
    private readonly RegistryBackupManager _registry;
    private readonly SystemRestoreManager _restore;
    private readonly SafetyCheckpoint _safety;

    public SafetyCheckpointTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "VeloSys_SafetyTests_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);
        _cmd = new FakeCommandRunner();
        _sink = new RecordingStatusSink();
        _registry = new RegistryBackupManager(_tempDir, _cmd, _sink);
        _restore = new SystemRestoreManager(_cmd, _sink);
        _safety = new SafetyCheckpoint(_restore, _registry, _sink);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            try { Directory.Delete(_tempDir, true); } catch { }
        }
    }

    [Fact]
    public void ExecuteMaintenanceBackup_WhenDisabled_SkipsBackup()
    {
        _safety.Enabled = false;
        bool result = _safety.ExecuteMaintenanceBackup();

        Assert.True(result);
        Assert.DoesNotContain(_cmd.Runs, r => r.Exe.Contains("reg.exe", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void ExecuteMaintenanceBackup_WhenEnabled_RunsRegistryExport()
    {
        _safety.Enabled = true;
        bool onCreatedFired = false;
        var safetyWithCallback = new SafetyCheckpoint(_restore, _registry, _sink, () => onCreatedFired = true);

        bool result = safetyWithCallback.ExecuteMaintenanceBackup();

        Assert.True(result);
        Assert.True(onCreatedFired);
        Assert.Contains(_cmd.Runs, r => r.Exe.Contains("reg.exe", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(_sink.Logs, l => l.Key == "log.backup.created");
    }

    [Fact]
    public void ExecuteTweakCheckpoint_WhenDisabled_LogsSkipAndReturnsTrue()
    {
        _safety.Enabled = false;
        bool result = _safety.ExecuteTweakCheckpoint();

        Assert.True(result);
        Assert.Contains(_sink.Logs, l => l.Key == "log.tweaks.checkpointSkipped");
    }

    [Fact]
    public void ExecuteTweakCheckpoint_WhenProtectionDisabled_FailsEarlyWithKey()
    {
        _safety.Enabled = true;
        // Default FakeCommandRunner returns empty output which means protection disabled (RPSerialization is 0 / absent)
        bool result = _safety.ExecuteTweakCheckpoint();

        Assert.False(result);
        Assert.Contains(_sink.Logs, l => l.Key == "log.tweaks.protectionDisabled" && l.Type == "error");
    }

    [Fact]
    public void ExecuteTweakCheckpoint_WhenProtectionEnabled_CreatesRestorePoint()
    {
        _safety.Enabled = true;
        _cmd.CapturedOutputsByArgs.Add(("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x1\n"));
        _cmd.CapturedOutputsByArgs.Add(("Get-ComputerRestorePoint", "1\n"));

        bool result = _safety.ExecuteTweakCheckpoint();

        Assert.True(result);
        Assert.Contains(_sink.Logs, l => l.Key == "log.tweaks.checkpointCreated" && l.Type == "success");
    }
}
