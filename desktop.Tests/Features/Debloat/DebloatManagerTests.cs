using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// Covers enumeration parsing, the allow-list boundary, restore-point ordering, and the per-entry
/// results a partially successful batch has to report.
/// </summary>
public class DebloatManagerTests
{
    private const string ProtectionOn = "    RPSessionInterval    REG_DWORD    0x1\r\n";

    private sealed class Harness
    {
        public FakeCommandRunner Runner { get; } = new();
        public RecordingStatusSink Sink { get; } = new();
        public SafetyCheckpoint Checkpoint { get; }
        public DebloatManager Manager { get; }

        public Harness(string installedJson = "[]")
        {
            Runner.CapturedOutputsByArgs.Add(("RPSessionInterval", ProtectionOn));
            Runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "1"));
            Runner.CapturedOutputsByArgs.Add(("Get-AppxPackage |", installedJson));

            Checkpoint = new SafetyCheckpoint(new SystemRestoreManager(Runner, Sink), Sink);
            Manager = new DebloatManager(DebloatCatalog.CreateDefault(), Runner, Checkpoint, Sink);
        }

        /// <summary>Commands that would actually uninstall something.</summary>
        public List<(string Exe, string Args)> RemovalCommands =>
            Runner
                .Runs.Where(run =>
                    run.Args.Contains("Remove-AppxPackage", StringComparison.OrdinalIgnoreCase)
                    || run.Args.Contains("/uninstall", StringComparison.OrdinalIgnoreCase)
                )
                .ToList();
    }

    private static JsonElement PackagesOf(string json) =>
        JsonDocument.Parse(json).RootElement.GetProperty("packages");

    private static JsonElement PackageNamed(string json, string id) =>
        PackagesOf(json).EnumerateArray().Single(entry => entry.GetProperty("id").GetString() == id);

    [Fact]
    public void EnumerationReportsEveryCatalogEntryAndNothingElse()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\",\"Microsoft.WindowsStore\"]");

        JsonElement packages = PackagesOf(harness.Manager.GetPackagesJson());

        Assert.Equal(DebloatCatalog.CreateDefault().Entries.Count, packages.GetArrayLength());
        Assert.DoesNotContain(
            packages.EnumerateArray(),
            entry => entry.GetProperty("id").GetString() == "Microsoft.WindowsStore"
        );
    }

    [Fact]
    public void EnumerationMarksOnlyThePackagesTheSystemReports()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        string json = harness.Manager.GetPackagesJson();

        Assert.True(PackageNamed(json, "weather").GetProperty("installed").GetBoolean());
        Assert.False(PackageNamed(json, "news").GetProperty("installed").GetBoolean());
    }

    [Fact]
    public void EnumerationHandlesTheSinglePackageCaseConvertToJsonEmitsAsAScalar()
    {
        // `ConvertTo-Json` drops the array wrapper when the pipeline yields exactly one object,
        // which is how a machine with one leftover package would otherwise read as none.
        var harness = new Harness("\"Microsoft.BingWeather\"");

        Assert.True(
            PackageNamed(harness.Manager.GetPackagesJson(), "weather")
                .GetProperty("installed")
                .GetBoolean()
        );
    }

    [Fact]
    public void EnumerationCarriesTheGroupAndTheReinstallCaveat()
    {
        var harness = new Harness();
        string json = harness.Manager.GetPackagesJson();

        Assert.Equal("Safe", PackageNamed(json, "weather").GetProperty("group").GetString());
        Assert.Equal("store", PackageNamed(json, "weather").GetProperty("caveat").GetString());
        Assert.Equal("Optional", PackageNamed(json, "oneDrive").GetProperty("group").GetString());
        Assert.Equal("oneDrive", PackageNamed(json, "oneDrive").GetProperty("caveat").GetString());
    }

    [Fact]
    public void EnumerationSurvivesAnUnreadableAppxQuery()
    {
        var harness = new Harness("not json at all");

        JsonElement packages = PackagesOf(harness.Manager.GetPackagesJson());

        // The list still describes the catalog; nothing is claimed to be installed.
        Assert.Equal(DebloatCatalog.CreateDefault().Entries.Count, packages.GetArrayLength());
        Assert.All(packages.EnumerateArray(), entry => Assert.False(entry.GetProperty("installed").GetBoolean()));
    }

    [Theory]
    [InlineData("Microsoft.BingWeather")]
    [InlineData("weather*")]
    [InlineData("weathe")]
    [InlineData("*")]
    [InlineData("")]
    public void AnIdOutsideTheAllowListIssuesNoCommandAtAll(string id)
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        DebloatBatchResult result = harness.Manager.Remove(new[] { id });

        Assert.False(result.Ok);
        Assert.Empty(result.Results);
        // Not just "no removal ran": the batch must be refused before the restore point too, so a
        // malformed payload cannot make the machine do work of any kind.
        Assert.Empty(harness.Runner.Runs);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.debloat.unknown");
    }

    [Fact]
    public void OneBadIdInAnOtherwiseValidBatchStopsTheWholeBatch()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather", "Microsoft.Copilot" });

        Assert.False(result.Ok);
        Assert.Empty(harness.Runner.Runs);
    }

    [Fact]
    public void RemovalIsRefusedWhenNoRestorePointCanBeCreated()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");
        harness.Runner.CapturedOutputsByArgs.Insert(
            0,
            ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x0\r\n")
        );

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather" });

        Assert.False(result.Ok);
        Assert.Empty(result.Results);
        Assert.Empty(harness.RemovalCommands);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.checkpoint.protectionDisabled");
    }

    [Fact]
    public void RemovalIsRefusedWhenTheCheckpointExitsZeroWithoutCreatingAnything()
    {
        // Checkpoint-Computer warns and exits 0 when the once-per-day cap denies it, so the manager
        // must trust the read-back and not the exit code.
        var harness = new Harness("[\"Microsoft.BingWeather\"]");
        harness.Runner.CapturedOutputsByArgs.Insert(0, ("ExpandProperty Count", "0"));

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather" });

        Assert.False(result.Ok);
        Assert.Empty(harness.RemovalCommands);
    }

    [Fact]
    public void TheRestorePointPrecedesTheFirstRemoval()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        harness.Manager.Remove(new[] { "weather" });

        int checkpoint = harness.Runner.Runs.FindIndex(run =>
            run.Args.Contains("Checkpoint-Computer", StringComparison.Ordinal)
        );
        int removal = harness.Runner.Runs.FindIndex(run =>
            run.Args.Contains("Remove-AppxPackage", StringComparison.Ordinal)
        );

        Assert.True(checkpoint >= 0, "no Safety Checkpoint was created");
        Assert.True(removal >= 0, "no removal was issued");
        Assert.True(checkpoint < removal, "the removal ran before the Safety Checkpoint");
    }

    [Fact]
    public void RemovalTargetsOnlyThePackageNamesTheCatalogDeclares()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        harness.Manager.Remove(new[] { "weather" });

        (string Exe, string Args) command = Assert.Single(harness.RemovalCommands);
        Assert.Equal("powershell.exe", command.Exe);
        Assert.Contains("-Name 'Microsoft.BingWeather'", command.Args, StringComparison.Ordinal);
        Assert.DoesNotContain("*", command.Args, StringComparison.Ordinal);
    }

    [Fact]
    public void XboxIssuesOneRemovalPerDeclaredPackage()
    {
        var harness = new Harness("[\"Microsoft.GamingApp\",\"Microsoft.Xbox.TCUI\"]");

        harness.Manager.Remove(new[] { "xbox" });

        Assert.Equal(2, harness.RemovalCommands.Count);
        Assert.Contains(harness.RemovalCommands, run => run.Args.Contains("Microsoft.GamingApp", StringComparison.Ordinal));
        Assert.Contains(harness.RemovalCommands, run => run.Args.Contains("Microsoft.Xbox.TCUI", StringComparison.Ordinal));
    }

    [Fact]
    public void APackageStillPresentAfterTheRemovalIsReportedAsAFailure()
    {
        // A zero exit code is not evidence: the manager re-reads the installed set and reports what
        // it finds, so a removal Windows quietly declined cannot be announced as a gain.
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather" });

        DebloatPackageResult entry = Assert.Single(result.Results);
        Assert.Equal("weather", entry.Id);
        Assert.False(entry.Ok);
        Assert.False(result.Ok);
    }

    [Fact]
    public void APackageGoneAfterTheRemovalIsReportedAsASuccess()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");
        // The read-back after the removal sees an empty machine.
        harness.Runner.CapturedOutputsByArgs.Insert(0, ("Get-AppxPackage |", "[]"));

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather" });

        Assert.True(result.Ok);
        Assert.True(Assert.Single(result.Results).Ok);
    }

    [Fact]
    public void AMixedBatchReportsEachEntryOnItsOwn()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\",\"Microsoft.BingNews\"]");
        // Only the news package really went; weather is still there when the read-back runs.
        harness.Runner.CapturedOutputsByArgs.Insert(0, ("Get-AppxPackage |", "[\"Microsoft.BingWeather\"]"));

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather", "news" });

        Assert.False(result.Ok);
        Assert.Equal(2, result.Results.Count);
        Assert.False(result.Results.Single(entry => entry.Id == "weather").Ok);
        Assert.True(result.Results.Single(entry => entry.Id == "news").Ok);
    }

    [Fact]
    public void AnUnreadableVerificationReadReportsEveryPackageAsStillInstalled()
    {
        // The load path treats an unreadable query as "nothing is installed", which is the safe
        // direction there: the UI then offers nothing to remove. On the read-back the very same
        // answer means the opposite, and taking it at face value would report every selected app
        // as removed on the strength of a query that never ran
        // (.agents/rules/absence-of-error-is-not-success.md).
        var harness = new Harness("[\"Microsoft.BingWeather\",\"Microsoft.BingNews\"]");
        harness.Runner.FailingCapturesByArgs.Add("Get-AppxPackage |");

        DebloatBatchResult result = harness.Manager.Remove(new[] { "weather", "news" });

        Assert.False(result.Ok);
        Assert.Equal(2, result.Results.Count);
        Assert.All(result.Results, entry => Assert.False(entry.Ok));
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.debloat.unverified");
        // And it must not be reported as a success in the log trail either.
        Assert.DoesNotContain(harness.Sink.Logs, log => log.Key == "log.debloat.removed");
    }

    [Fact]
    public void AnUnverifiableReadStillLeavesTheRemovalCommandsIssued()
    {
        // The apps really may be gone; what is missing is the proof. The batch reports failure
        // rather than pretending nothing was attempted, so the next refresh tells the truth.
        var harness = new Harness("[\"Microsoft.BingWeather\"]");
        harness.Runner.FailingCapturesByArgs.Add("Get-AppxPackage |");

        harness.Manager.Remove(new[] { "weather" });

        Assert.Single(harness.RemovalCommands);
    }

    [Fact]
    public void OneDriveIsNeverReportedAsRemovedWhenNoUninstallerRan()
    {
        // The registry marker is gone — but nothing this app did removed it, because no uninstaller
        // was ever found. Trusting the read-back alone here would report a removal that never
        // happened, on a machine where OneDrive may simply never have been installed.
        var harness = new Harness();
        harness.Runner.CapturedOutputsByArgs.Add(("OneDriveSetup.exe", ""));

        DebloatBatchResult result = harness.Manager.Remove(new[] { "oneDrive" });

        Assert.False(result.Ok);
        Assert.False(Assert.Single(result.Results).Ok);
        Assert.Empty(harness.RemovalCommands);
    }

    [Fact]
    public void OneDriveIsRemovedThroughItsOwnUninstallerAndNotThroughAppx()
    {
        var harness = new Harness();
        harness.Runner.CapturedOutputsByArgs.Add(
            ("OneDriveSetup.exe", "C:\\Windows\\SysWOW64\\OneDriveSetup.exe\r\n")
        );

        harness.Manager.Remove(new[] { "oneDrive" });

        (string Exe, string Args) command = Assert.Single(harness.RemovalCommands);
        Assert.Equal("C:\\Windows\\SysWOW64\\OneDriveSetup.exe", command.Exe);
        Assert.Equal("/uninstall", command.Args);
    }

    [Fact]
    public void OneDriveFailsHonestlyWhenNoUninstallerIsOnTheMachine()
    {
        var harness = new Harness();
        // OneDrive really is installed; it is only its uninstaller that cannot be found.
        harness.Runner.CapturedOutputsByArgs.Add(
            (@"Software\Microsoft\OneDrive", "    CurrentVersionPath    REG_SZ    C:\\OneDrive\r\n")
        );
        harness.Runner.CapturedOutputsByArgs.Add(("OneDriveSetup.exe", ""));

        DebloatBatchResult result = harness.Manager.Remove(new[] { "oneDrive" });

        Assert.False(result.Ok);
        Assert.False(Assert.Single(result.Results).Ok);
        Assert.Empty(harness.RemovalCommands);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.debloat.noUninstaller");
    }

    [Fact]
    public void AnEmptySelectionChangesNothing()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");

        DebloatBatchResult result = harness.Manager.Remove(Array.Empty<string>());

        Assert.False(result.Ok);
        Assert.Empty(harness.Runner.Runs);
    }

    [Fact]
    public void TheCheckpointIsSkippedOnlyWhenThePreferenceSaysSo()
    {
        var harness = new Harness("[\"Microsoft.BingWeather\"]");
        harness.Checkpoint.Enabled = false;

        harness.Manager.Remove(new[] { "weather" });

        Assert.DoesNotContain(
            harness.Runner.Runs,
            run => run.Args.Contains("Checkpoint-Computer", StringComparison.Ordinal)
        );
        Assert.NotEmpty(harness.RemovalCommands);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.checkpoint.skipped");
    }
}
