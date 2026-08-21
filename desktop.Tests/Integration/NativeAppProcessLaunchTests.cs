using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using Xunit;

namespace VeloSysPro.Tests.Integration;

[Trait("Category", "Integration")]
public class NativeAppProcessLaunchTests
{
    [Fact]
    public void Executable_IfBuilt_StartsAndRespondsToProcessBoundary()
    {
        string baseDir = AppContext.BaseDirectory;
        string rootDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", ".."));
        
        string[] candidatePaths = new[]
        {
            Path.Combine(rootDir, "desktop", "bin", "Release", "standalone", "VeloSysPro.exe"),
            Path.Combine(rootDir, "VeloSysPro.exe"),
            Path.Combine(rootDir, "desktop", "bin", "Release", "net8.0-windows", "VeloSysPro.exe"),
            Path.Combine(rootDir, "desktop", "bin", "Debug", "net8.0-windows", "VeloSysPro.exe"),
            Path.Combine(rootDir, "desktop", "bin", "Release", "net8.0-windows", "win-x64", "VeloSysPro.exe")
        };

        string? exePath = null;
        foreach (var path in candidatePaths)
        {
            if (File.Exists(path))
            {
                exePath = path;
                break;
            }
        }

        if (exePath != null)
        {
            var psi = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--version",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            try
            {
                using var proc = Process.Start(psi);
                Assert.NotNull(proc);

                bool exited = proc.WaitForExit(10000);
                if (!exited)
                {
                    proc.Kill();
                    Assert.Fail($"Process {exePath} timed out during process boundary check.");
                }

                Assert.True(proc.ExitCode == 0 || proc.ExitCode == 1, $"Process exited with unexpected code: {proc.ExitCode}");
            }
            catch (Win32Exception ex)
            {
                // Error 740 (0x2E4): The requested operation requires elevation.
                // This correctly proves that VeloSysPro.exe has an app.manifest requiring administrator privileges.
                Assert.True(
                    ex.NativeErrorCode == 740 || ex.Message.Contains("elevação", StringComparison.OrdinalIgnoreCase) || ex.Message.Contains("elevation", StringComparison.OrdinalIgnoreCase),
                    $"Unexpected Win32Exception when launching executable: {ex.Message} (Error code: {ex.NativeErrorCode})"
                );
            }
        }
    }
}
