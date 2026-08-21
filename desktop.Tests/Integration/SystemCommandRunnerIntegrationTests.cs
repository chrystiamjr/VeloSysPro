using System;
using Microsoft.Win32;
using Xunit;

namespace VeloSysPro.Tests.Integration;

#pragma warning disable CA1416 // Windows registry API validation
[Trait("Category", "Integration")]
public class SystemCommandRunnerIntegrationTests
{
    private const string TempTestKeyPath = @"HKCU\Software\VeloSysProTestSandboxTemp";
    private const string ValueName = "TestMetricSetting";

    [Fact]
    public void SystemCommandRunner_QueriesSystemInfoAndHandlesOutputEncoding()
    {
        var sink = new RecordingStatusSink();
        var runner = new CommandRunner(sink);

        var capture = runner.RunCapture(
            "reg.exe",
            @"query ""HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion"" /v ProductName"
        );

        Assert.True(capture.Success, "Expected reg query for ProductName to succeed.");
        Assert.Equal(0, capture.ExitCode);
        Assert.Contains("ProductName", capture.Output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("REG_SZ", capture.Output, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RegistryTweak_ExecutesRealRegExeAgainstTemporaryHKCUSubkey()
    {
        var sink = new RecordingStatusSink();
        var runner = new CommandRunner(sink);
        using var tempDir = new TemporaryDirectory();
        var backupManager = new RegistryBackupManager(tempDir.Path, runner, sink, tempDir.Path);

        // Ensure temporary test registry parent key exists and is clean of test value
        runner.Run("reg.exe", $"add \"{TempTestKeyPath}\" /f");

        try
        {
            var tweak = new RegistryTweak(
                "test.safeRegistrySetting",
                TweakCategories.System,
                RiskTier.Safe,
                TempTestKeyPath,
                new[] { new RegistryValue(ValueName, "REG_DWORD", "1") },
                runner,
                backupManager
            );

            // 1. Initial State: Should be NotApplied
            Assert.Equal(TweakState.NotApplied, tweak.Detect());

            // 2. Capture prior state (reads parent key, records Existed = false) & Apply
            var tweakCapture = tweak.Capture();
            Assert.NotEmpty(tweakCapture.Values);
            Assert.False(tweakCapture.Values[0].Existed);

            bool applied = tweak.Apply(tweakCapture);
            Assert.True(applied, "RegistryTweak.Apply(capture) should succeed on HKCU.");
            Assert.Equal(TweakState.Applied, tweak.Detect());

            // 3. Verify via direct reg query
            var queryCapture = runner.RunCapture("reg.exe", $"query \"{TempTestKeyPath}\" /v \"{ValueName}\"");
            Assert.True(queryCapture.Success);
            Assert.Contains("0x1", queryCapture.Output, StringComparison.OrdinalIgnoreCase);

            // 4. Revert & Cleanup (deletes value because Existed was false)
            bool reverted = tweak.Revert(tweakCapture);
            Assert.True(reverted, "RegistryTweak.Revert(capture) should succeed.");
            Assert.Equal(TweakState.NotApplied, tweak.Detect());
        }
        finally
        {
            // Clean up temporary registry key
            using var hkcu = Registry.CurrentUser;
            try { hkcu.DeleteSubKeyTree(@"Software\VeloSysProTestSandboxTemp", false); } catch { }
        }
    }

    [Fact]
    public void SystemCommandRunner_RunsPowerShellAndReturnsExitCodeAndOutput()
    {
        var sink = new RecordingStatusSink();
        var runner = new CommandRunner(sink);

        var capture = runner.RunCapture(
            "powershell.exe",
            "-NoProfile -ExecutionPolicy Bypass -Command \"Write-Output 'VeloSysPro_OS_Boundary_Check'\""
        );

        Assert.True(capture.Success);
        Assert.Equal(0, capture.ExitCode);
        Assert.Contains("VeloSysPro_OS_Boundary_Check", capture.Output);
    }
}
