using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// Drives the Tweaks the app actually ships, through <see cref="TweakCatalog.CreateDefault"/>,
/// against a scripted command runner. The unit tests beside this one prove the mechanisms; these
/// prove the catalog entries themselves — the exact key, value names, types, and target data — so
/// a typo in a key path or a value name fails here rather than on a user's machine.
/// </summary>
public class CatalogTweakTests
{
    private sealed class ShippedCatalog : IDisposable
    {
        private readonly TemporaryDirectory _temp = new();
        private readonly TweakCatalog _catalog;

        public ShippedCatalog()
        {
            _catalog = TweakCatalog.CreateDefault(
                Runner,
                new RegistryBackupManager(_temp.Path, Runner, new RecordingStatusSink(), _temp.Path)
            );
        }

        public ScriptedCommandRunner Runner { get; } = new();

        public ITweak Find(string id) =>
            _catalog.Find(id) ?? throw new InvalidOperationException("No such Tweak: " + id);

        /// <summary>Answers the key-readable probe that precedes every capture.</summary>
        public void KeyReadsBack() => Runner.EnqueueCapture("HKEY_LOCAL_MACHINE\\SomeKey\r\n");

        public void Value(string name, string type, string data) =>
            Runner.EnqueueCapture(
                "\r\nHKEY_LOCAL_MACHINE\\SomeKey\r\n    "
                    + name
                    + "    "
                    + type
                    + "    "
                    + data
                    + "\r\n\r\n"
            );

        /// <summary>A value reg.exe cannot find — indistinguishable from a failed query by design.</summary>
        public void ValueAbsent() => Runner.EnqueueFailedCapture();

        public List<string> Args => Runner.Runs.Select(run => run.Args).ToList();

        public void Dispose() => _temp.Dispose();
    }

    // ---- E2-01 — MMCSS group -------------------------------------------------------------------

    [Theory]
    [InlineData("0xa", TweakState.Applied)] // 10, the target
    [InlineData("0x14", TweakState.NotApplied)] // 20, what Windows ships
    [InlineData("0x0", TweakState.NotApplied)]
    public void SystemResponsiveness_DetectsOnlyTheExactTargetValue(string live, TweakState expected)
    {
        using var catalog = new ShippedCatalog();
        catalog.Value("SystemResponsiveness", "REG_DWORD", live);

        Assert.Equal(expected, catalog.Find("cpu.systemResponsiveness").Detect());
        Assert.Equal(
            new[] { "query \"" + Mmcss + "\" /v \"SystemResponsiveness\"" },
            catalog.Args
        );
    }

    [Theory]
    [InlineData("0xffffffff", TweakState.Applied)]
    [InlineData("0xa", TweakState.NotApplied)] // 10, what Windows ships
    public void NetworkThrottling_DetectsTheNoThrottlingSentinel(string live, TweakState expected)
    {
        using var catalog = new ShippedCatalog();
        catalog.Value("NetworkThrottlingIndex", "REG_DWORD", live);

        Assert.Equal(expected, catalog.Find("network.throttlingIndex").Detect());
    }

    [Fact]
    public void MmccsTweaks_AreSeparateSoRevertingOneLeavesTheOtherAlone()
    {
        // They share a registry key. If they were one Tweak, or if Revert re-imported the whole key,
        // undoing the network setting would silently undo the scheduler one — the reason E0 made
        // Revert restore recorded values instead of the exported .reg.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("SystemResponsiveness", "REG_DWORD", "0x14");

        ITweak responsiveness = catalog.Find("cpu.systemResponsiveness");
        TweakCapture capture = responsiveness.Capture();
        catalog.Runner.Runs.Clear();

        Assert.True(responsiveness.Revert(capture));

        string restore = Assert.Single(catalog.Args, arg => arg.StartsWith("add "));
        Assert.Contains("/v \"SystemResponsiveness\"", restore);
        Assert.DoesNotContain("NetworkThrottlingIndex", string.Join(" ", catalog.Args));
    }

    [Fact]
    public void MmccsTweaks_RoundTripTheOriginalValueExactly()
    {
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("NetworkThrottlingIndex", "REG_DWORD", "0xa");

        ITweak throttling = catalog.Find("network.throttlingIndex");
        TweakCapture capture = throttling.Capture();

        Assert.True(throttling.Apply(capture));
        Assert.Contains("/d \"4294967295\"", catalog.Args.Last());

        Assert.True(throttling.Revert(capture));
        Assert.Contains("/d \"0xa\"", catalog.Args.Last());
    }

    // ---- E2-02 — Games task priorities ---------------------------------------------------------

    /// <summary>The Tweak's three values in the order it queries them, with their target data.</summary>
    private static readonly (string Name, string Type, string Applied, string Other)[] GamesFields =
    {
        ("GPU Priority", "REG_DWORD", "0x8", "0x2"),
        ("Priority", "REG_DWORD", "0x6", "0x2"),
        ("Scheduling Category", "REG_SZ", "High", "Medium"),
    };

    [Fact]
    public void GamesTaskPriority_ReportsAppliedOnlyWhenAllThreeValuesMatch()
    {
        using var catalog = new ShippedCatalog();
        foreach (var field in GamesFields) catalog.Value(field.Name, field.Type, field.Applied);

        Assert.Equal(TweakState.Applied, catalog.Find("cpu.gamesTaskPriority").Detect());
    }

    [Fact]
    public void GamesTaskPriority_ReportsNotAppliedWhenNoValueMatches()
    {
        // What the verified machine actually holds for two of the three: Priority 0x2 and
        // Scheduling Category "Medium".
        using var catalog = new ShippedCatalog();
        foreach (var field in GamesFields) catalog.Value(field.Name, field.Type, field.Other);

        Assert.Equal(TweakState.NotApplied, catalog.Find("cpu.gamesTaskPriority").Detect());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void GamesTaskPriority_ReportsPartialWhenExactlyOneFieldIsWrong(int wrongIndex)
    {
        // A per-field probe rather than one "mixed" case: with a single mixed fixture, a Tweak that
        // ignored one of its three values would still pass.
        using var catalog = new ShippedCatalog();
        for (int i = 0; i < GamesFields.Length; i++)
        {
            var field = GamesFields[i];
            catalog.Value(field.Name, field.Type, i == wrongIndex ? field.Other : field.Applied);
        }

        Assert.Equal(TweakState.Partial, catalog.Find("cpu.gamesTaskPriority").Detect());
    }

    [Fact]
    public void GamesTaskPriority_ConvergesAllThreeValuesAndIsIdempotent()
    {
        using var catalog = new ShippedCatalog();
        ITweak games = catalog.Find("cpu.gamesTaskPriority");
        var capture = new TweakCapture(games.Id, TweakKinds.Registry, "", new CapturedValue[0]);

        Assert.True(games.Apply(capture));
        string[] first = catalog.Args.ToArray();
        catalog.Runner.Runs.Clear();

        Assert.True(games.Apply(capture));

        Assert.Equal(first, catalog.Args);
        Assert.Equal(
            new[]
            {
                "add \"" + Games + "\" /v \"GPU Priority\" /t REG_DWORD /d \"8\" /f",
                "add \"" + Games + "\" /v \"Priority\" /t REG_DWORD /d \"6\" /f",
                "add \"" + Games + "\" /v \"Scheduling Category\" /t REG_SZ /d \"High\" /f",
            },
            first
        );
    }

    [Fact]
    public void GamesTaskPriority_RestoresAMixedOriginalStateExactly()
    {
        // One value present with its own data, one present with different data, one absent: the
        // three cases Revert has to tell apart.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("GPU Priority", "REG_DWORD", "0x8");
        catalog.Value("Priority", "REG_DWORD", "0x2");
        catalog.ValueAbsent(); // Scheduling Category

        ITweak games = catalog.Find("cpu.gamesTaskPriority");
        TweakCapture capture = games.Capture();
        catalog.Runner.Runs.Clear();

        Assert.True(games.Revert(capture));

        Assert.Equal(
            new[]
            {
                "add \"" + Games + "\" /v \"GPU Priority\" /t REG_DWORD /d \"0x8\" /f",
                "add \"" + Games + "\" /v \"Priority\" /t REG_DWORD /d \"0x2\" /f",
                "delete \"" + Games + "\" /v \"Scheduling Category\" /f",
            },
            catalog.Args
        );
    }

    // ---- E2-03 — TCP parameters ----------------------------------------------------------------

    private static readonly (string Name, string Applied, string Other)[] TcpFields =
    {
        ("DefaultTTL", "0x40", "0x80"),
        ("Tcp1323Opts", "0x1", "0x0"),
        ("TCPTimedWaitDelay", "0x1e", "0xf0"),
        ("MaxUserPort", "0xfffe", "0x1388"),
    };

    [Fact]
    public void TcpParameters_ReportsAppliedOnlyWhenEveryFieldMatches()
    {
        using var catalog = new ShippedCatalog();
        foreach (var field in TcpFields) catalog.Value(field.Name, "REG_DWORD", field.Applied);

        Assert.Equal(TweakState.Applied, catalog.Find("network.tcpParameters").Detect());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void TcpParameters_ReportsPartialWhenExactlyOneFieldIsWrong(int wrongIndex)
    {
        using var catalog = new ShippedCatalog();
        for (int i = 0; i < TcpFields.Length; i++)
        {
            var field = TcpFields[i];
            catalog.Value(field.Name, "REG_DWORD", i == wrongIndex ? field.Other : field.Applied);
        }

        Assert.Equal(TweakState.Partial, catalog.Find("network.tcpParameters").Detect());
    }

    [Fact]
    public void TcpParameters_WriteOnlyTheFourAllowListedValues()
    {
        using var catalog = new ShippedCatalog();
        ITweak tcp = catalog.Find("network.tcpParameters");

        Assert.True(tcp.Apply(new TweakCapture(tcp.Id, TweakKinds.Registry, "", new CapturedValue[0])));

        Assert.Equal(
            new[]
            {
                "add \"" + Tcpip + "\" /v \"DefaultTTL\" /t REG_DWORD /d \"64\" /f",
                "add \"" + Tcpip + "\" /v \"Tcp1323Opts\" /t REG_DWORD /d \"1\" /f",
                "add \"" + Tcpip + "\" /v \"TCPTimedWaitDelay\" /t REG_DWORD /d \"30\" /f",
                "add \"" + Tcpip + "\" /v \"MaxUserPort\" /t REG_DWORD /d \"65534\" /f",
            },
            catalog.Args
        );
    }

    [Fact]
    public void TcpParameters_NeverTouchTheNagleSettingsOrAnyNetworkInterface()
    {
        // TcpNoDelay and TcpAckFrequency are per-NIC and Advanced (E5-02). This Tweak is the Safe,
        // machine-wide half, and enumerating adapters here is what would blur that line.
        using var catalog = new ShippedCatalog();
        ITweak tcp = catalog.Find("network.tcpParameters");

        tcp.Detect();
        tcp.Apply(new TweakCapture(tcp.Id, TweakKinds.Registry, "", new CapturedValue[0]));

        string everything = string.Join(" ", catalog.Args);
        Assert.DoesNotContain("TcpNoDelay", everything);
        Assert.DoesNotContain("TcpAckFrequency", everything);
        Assert.DoesNotContain("Interfaces", everything);
    }

    [Fact]
    public void TcpParameters_RoundTripAnEntirelyAbsentStartingState()
    {
        // The verified machine has none of the four, so "absent" is the ordinary case here rather
        // than an edge one: Revert has to delete all four, not write zeroes.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        for (int i = 0; i < TcpFields.Length; i++) catalog.ValueAbsent();

        ITweak tcp = catalog.Find("network.tcpParameters");
        TweakCapture capture = tcp.Capture();
        Assert.True(tcp.Apply(capture));
        catalog.Runner.Runs.Clear();

        Assert.True(tcp.Revert(capture));

        Assert.Equal(
            TcpFields.Select(field => "delete \"" + Tcpip + "\" /v \"" + field.Name + "\" /f"),
            catalog.Args
        );
    }

    [Fact]
    public void TcpParameters_NeedARestartAndAreThereforeNotRecommended()
    {
        using var catalog = new ShippedCatalog();

        Assert.True(catalog.Find("network.tcpParameters").RequiresReboot);
    }

    // ---- E2-04 — FSE / GameDVR -----------------------------------------------------------------

    [Fact]
    public void FullscreenExclusive_ReadsTheLocationWindowsActuallyUses()
    {
        // HKCU\System\GameConfigStore, read on a real machine on 2026-07-27 with both values
        // present and set to 0 — this is not a key taken from a guide.
        using var catalog = new ShippedCatalog();
        catalog.Value("GameDVR_FSEBehaviorMode", "REG_DWORD", "0x2");
        catalog.Value("GameDVR_HonorUserFSEBehaviorMode", "REG_DWORD", "0x1");

        Assert.Equal(TweakState.Applied, catalog.Find("graphics.fullscreenExclusive").Detect());
        Assert.All(catalog.Args, arg => Assert.Contains(@"HKCU\System\GameConfigStore", arg));
    }

    [Theory]
    [InlineData("0x0", "0x1")]
    [InlineData("0x2", "0x0")]
    public void FullscreenExclusive_ReportsPartialWhenOnlyOneValueMatches(string fse, string honor)
    {
        using var catalog = new ShippedCatalog();
        catalog.Value("GameDVR_FSEBehaviorMode", "REG_DWORD", fse);
        catalog.Value("GameDVR_HonorUserFSEBehaviorMode", "REG_DWORD", honor);

        Assert.Equal(TweakState.Partial, catalog.Find("graphics.fullscreenExclusive").Detect());
    }

    [Fact]
    public void FullscreenExclusive_RoundTripsTheZeroesTheMachineShipsWith()
    {
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("GameDVR_FSEBehaviorMode", "REG_DWORD", "0x0");
        catalog.Value("GameDVR_HonorUserFSEBehaviorMode", "REG_DWORD", "0x0");

        ITweak fse = catalog.Find("graphics.fullscreenExclusive");
        TweakCapture capture = fse.Capture();

        Assert.True(fse.Apply(capture));
        Assert.Equal(
            new[] { "/d \"2\"", "/d \"1\"" },
            catalog.Args.Where(arg => arg.StartsWith("add ")).Select(Payload)
        );

        catalog.Runner.Runs.Clear();
        Assert.True(fse.Revert(capture));
        Assert.Equal(new[] { "/d \"0x0\"", "/d \"0x0\"" }, catalog.Args.Select(Payload));
    }

    // ---- E2-05 — GPU scheduling + Game Mode ----------------------------------------------------

    [Fact]
    public void HardwareScheduling_RefusesToCreateAValueWindowsNeverExposed()
    {
        // HwSchMode is absent on the verified machine. Creating it would leave a registry value the
        // display driver ignores while the batch reported an optimization applied.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak hags = catalog.Find("graphics.hardwareScheduling");
        TweakCapture capture = hags.Capture();
        catalog.Runner.Runs.Clear();

        Assert.False(hags.Apply(capture));
        Assert.Empty(catalog.Args);
    }

    [Fact]
    public void HardwareScheduling_AppliesWhereWindowsDidExposeIt()
    {
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("HwSchMode", "REG_DWORD", "0x1"); // supported, currently off

        ITweak hags = catalog.Find("graphics.hardwareScheduling");
        TweakCapture capture = hags.Capture();
        catalog.Runner.Runs.Clear();

        Assert.True(hags.Apply(capture));
        Assert.Equal(
            "add \"" + GraphicsDrivers + "\" /v \"HwSchMode\" /t REG_DWORD /d \"2\" /f",
            Assert.Single(catalog.Args)
        );

        catalog.Runner.Runs.Clear();
        Assert.True(hags.Revert(capture));
        Assert.Contains("/d \"0x1\"", Assert.Single(catalog.Args));
    }

    [Fact]
    public void HardwareScheduling_NeedsARestartButGameModeDoesNot()
    {
        // Two toggles in two different hives with two different reboot stories, which is why they
        // are separate Tweaks rather than one "graphics" group.
        using var catalog = new ShippedCatalog();

        Assert.True(catalog.Find("graphics.hardwareScheduling").RequiresReboot);
        Assert.False(catalog.Find("graphics.gameMode").RequiresReboot);
    }

    [Fact]
    public void GameMode_RoundTripsAValueTheUserProfileDoesNotHaveYet()
    {
        // AllowAutoGameMode is absent on the verified machine even though the GameBar key exists.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak gameMode = catalog.Find("graphics.gameMode");
        TweakCapture capture = gameMode.Capture();

        Assert.True(gameMode.Apply(capture));
        Assert.Equal(
            "add \"" + GameBar + "\" /v \"AllowAutoGameMode\" /t REG_DWORD /d \"1\" /f",
            catalog.Args.Last()
        );

        catalog.Runner.Runs.Clear();
        Assert.True(gameMode.Revert(capture));
        Assert.Equal(
            "delete \"" + GameBar + "\" /v \"AllowAutoGameMode\" /f",
            Assert.Single(catalog.Args)
        );
    }

    // ---- E2-06 — Visual Effects ----------------------------------------------------------------

    [Theory]
    [InlineData("0x2", TweakState.Applied)]
    [InlineData("0x0", TweakState.NotApplied)] // "Let Windows choose", the shipped default
    [InlineData("0x1", TweakState.NotApplied)] // "Adjust for best appearance"
    public void VisualEffects_DetectsOnlyTheBestPerformanceSetting(string live, TweakState expected)
    {
        using var catalog = new ShippedCatalog();
        catalog.Value("VisualFXSetting", "REG_DWORD", live);

        Assert.Equal(expected, catalog.Find("system.visualEffects").Detect());
    }

    [Fact]
    public void VisualEffects_RoundTripsAnAbsentValue()
    {
        // The value is missing on the verified machine: Windows only writes it once the user opens
        // Performance Options, so Revert has to remove it rather than write a zero.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak effects = catalog.Find("system.visualEffects");
        TweakCapture capture = effects.Capture();

        Assert.True(effects.Apply(capture));
        catalog.Runner.Runs.Clear();

        Assert.True(effects.Revert(capture));
        Assert.Equal(
            "delete \"" + VisualEffects + "\" /v \"VisualFXSetting\" /f",
            Assert.Single(catalog.Args)
        );
    }

    // ---- Boot timers (E2 epic scope, beyond the six tickets) ------------------------------------

    [Fact]
    public void PlatformTick_SetsTheBcdElementAndRestoresItsAbsence()
    {
        using var catalog = new ShippedCatalog();
        catalog.Runner.EnqueueFailedCapture(); // bcdedit shows no useplatformtick

        ITweak tick = catalog.Find("boot.platformTick");
        TweakCapture capture = tick.Capture();
        catalog.Runner.Runs.Clear();

        Assert.True(tick.Apply(capture));
        Assert.Equal("/set {current} useplatformtick yes", Assert.Single(catalog.Args));

        catalog.Runner.Runs.Clear();
        Assert.True(tick.Revert(capture));
        Assert.Equal("/deletevalue {current} useplatformtick", Assert.Single(catalog.Args));
    }

    [Fact]
    public void PlatformClock_TreatsTheElementsAbsenceAsTheGoal()
    {
        // The research catalog states this one as "remove useplatformclock", so a machine that
        // never had it is already applied — and applying must not run bcdedit at all, because
        // deleting a missing element exits non-zero and would read as a failed optimization.
        using var catalog = new ShippedCatalog();
        catalog.Runner.EnqueueFailedCapture();

        ITweak clock = catalog.Find("boot.platformClock");

        Assert.Equal(TweakState.Applied, clock.Detect());

        catalog.Runner.EnqueueFailedCapture();
        TweakCapture capture = clock.Capture();
        catalog.Runner.Runs.Clear();

        Assert.True(clock.Apply(capture));
        Assert.Empty(catalog.Args);
    }

    [Fact]
    public void PlatformClock_RemovesTheElementAndPutsThePriorValueBack()
    {
        using var catalog = new ShippedCatalog();
        catalog.Runner.EnqueueCapture("\r\nuseplatformclock       Yes\r\n");

        ITweak clock = catalog.Find("boot.platformClock");
        TweakCapture capture = clock.Capture();
        catalog.Runner.Runs.Clear();

        Assert.True(clock.Apply(capture));
        Assert.Equal("/deletevalue {current} useplatformclock", Assert.Single(catalog.Args));

        catalog.Runner.Runs.Clear();
        Assert.True(clock.Revert(capture));
        Assert.Equal("/set {current} useplatformclock yes", Assert.Single(catalog.Args));
    }

    // ---- Cross-cutting -------------------------------------------------------------------------

    [Fact]
    public void GamingPreset_HoldsNothingThatRefusesToApplyOnAnOrdinaryMachine()
    {
        // A Preset is applied wholesale by the scheduler, with nobody there to read a row. GPU
        // Hardware Scheduling refuses where Windows never exposed HwSchMode — the common case — so
        // including it would make every headless --task=gaming run report failure.
        using var catalog = new ShippedCatalog();
        TweakCatalog shipped = TweakCatalog.CreateDefault(
            catalog.Runner,
            NewBackupManager(catalog.Runner)
        );

        Assert.DoesNotContain(
            "graphics.hardwareScheduling",
            Assert.Single(shipped.Presets).TweakIds
        );
        Assert.NotNull(shipped.Find("graphics.hardwareScheduling"));
    }

    [Fact]
    public void EveryTweak_DetectsWithoutWritingAnything()
    {
        // Detect runs on every catalog load, including the one the screen triggers on navigation.
        // A Tweak that mutated while reading would change the machine just by opening a tab.
        using var catalog = new ShippedCatalog();
        TweakCatalog shipped = TweakCatalog.CreateDefault(
            catalog.Runner,
            NewBackupManager(catalog.Runner)
        );

        foreach (ITweak tweak in shipped.Tweaks) tweak.Detect();

        Assert.DoesNotContain(catalog.Runner.Runs, run => run.Args.StartsWith("add "));
        Assert.DoesNotContain(catalog.Runner.Runs, run => run.Args.StartsWith("delete "));
        Assert.DoesNotContain(catalog.Runner.Runs, run => run.Args.StartsWith("/setactive"));
        Assert.DoesNotContain(catalog.Runner.Runs, run => run.Args.StartsWith("config "));
    }

    private const string Mmcss =
        @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile";
    private const string Games = Mmcss + @"\Tasks\Games";
    private const string Tcpip = @"HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters";
    private const string GraphicsDrivers =
        @"HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers";
    private const string GameBar = @"HKCU\Software\Microsoft\GameBar";
    private const string VisualEffects =
        @"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects";

    /// <summary>The <c>/d "…"</c> fragment of a reg.exe command, for comparing payloads.</summary>
    private static string Payload(string args)
    {
        int start = args.IndexOf("/d ", StringComparison.Ordinal);
        if (start < 0) return args;
        int end = args.IndexOf(" /f", start, StringComparison.Ordinal);
        return end < 0 ? args.Substring(start) : args.Substring(start, end - start);
    }

    private static RegistryBackupManager NewBackupManager(ICommandRunner runner)
    {
        var temp = new TemporaryDirectory();
        return new RegistryBackupManager(temp.Path, runner, new RecordingStatusSink(), temp.Path);
    }
}
