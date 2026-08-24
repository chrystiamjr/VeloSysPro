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

        // Exposed so a test that needs the whole catalog reuses this one rather than building a
        // second alongside it — each extra CreateDefault brought its own undisposed temp directory.
        public IReadOnlyList<ITweak> Tweaks => _catalog.Tweaks;

        public IReadOnlyList<Preset> Presets => _catalog.Presets;

        public IReadOnlyList<string> Recommended => _catalog.Recommended;

        /// <summary>Every service Tweak the shipped catalog registers.</summary>
        public IReadOnlyList<ITweak> ServiceTweaks =>
            _catalog.Tweaks.Where(tweak => tweak.Kind == TweakKinds.Service).ToList();

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

        /// <summary>
        /// A key that reads back holding nothing at all.
        /// </summary>
        /// <remarks>
        /// Exactly what reg.exe returns for an empty key, read on a real machine on 2026-08-23:
        /// exit 0 and a single line break, with not even the key's own path echoed back. A key
        /// holding anything prints its path and a line per value or subkey.
        /// </remarks>
        public void KeyIsEmpty() => Runner.EnqueueCapture("\r\n");

        /// <summary>Answers the optional-feature probe: this Windows image has the feature.</summary>
        public void FeaturePresent() => Runner.EnqueueCapture("present\r\n");

        /// <summary>...and the answer a machine without it gives.</summary>
        public void FeatureAbsent() => Runner.EnqueueCapture("absent\r\n");

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

    // ---- E3-02 — Safe services catalog ---------------------------------------------------------

    [Theory]
    [InlineData("services.sysMain", "SysMain")]
    [InlineData("services.diagTrack", "DiagTrack")]
    [InlineData("services.wSearch", "WSearch")]
    [InlineData("services.doSvc", "DoSvc")]
    public void SafeServices_TargetManualUnderTheirExactWindowsServiceName(string id, string service)
    {
        // The service name reaches both Get-Service and sc.exe verbatim, so a typo here is a Tweak
        // that silently never applies — Detect would read Unknown and report NotApplied forever.
        using var catalog = new ShippedCatalog();
        ITweak tweak = catalog.Find(id);
        catalog.Runner.EnqueueCapture("Automatic\r\n");

        Assert.Equal(TweakKinds.Service, tweak.Kind);
        Assert.Equal(TweakCategories.Services, tweak.Category);
        Assert.Equal(RiskTier.Safe, tweak.RiskTier);
        // The start type governs the next start; nothing here waits for a restart.
        Assert.False(tweak.RequiresReboot);

        Assert.True(tweak.Apply(tweak.Capture()));

        Assert.Contains("Get-Service -Name '" + service + "'", catalog.Args[0]);
        Assert.Equal("config " + service + " start= demand", catalog.Args[1]);
    }

    [Fact]
    public void SafeServices_ChangeWhenAServiceMayStartAndNothingElse()
    {
        // An allow-list, not a ban-list. Banning "stop " could never fail while ServiceTweak has a
        // single command site; this fails the moment any service Tweak learns a second verb —
        // stopping a service mid-session is a visible side effect Revert could not undo.
        using var catalog = new ShippedCatalog();

        foreach (ITweak tweak in catalog.ServiceTweaks)
        {
            catalog.Runner.EnqueueCapture("Automatic|0\r\n");
            TweakCapture capture = tweak.Capture();
            tweak.Apply(capture);
            tweak.Revert(capture);
        }

        foreach ((string exe, string args) in catalog.Runner.Runs)
        {
            bool reads = exe == "powershell.exe" && args.Contains("Get-Service -Name");
            bool setsStartType =
                exe == "sc.exe"
                && System.Text.RegularExpressions.Regex.IsMatch(
                    args,
                    @"^config [A-Za-z0-9_.\-]+ start= [a-z\-]+$"
                );

            Assert.True(reads || setsStartType, "unexpected command: " + exe + " " + args);
        }
    }

    [Fact]
    public void SafeServices_PullNothingForwardFromTheAdvancedTier()
    {
        // E3's own boundary, stated by its README: "Spooler and Xbox disables remain exclusively
        // in E5." Those are security- or feature-reducing and belong behind the Advanced
        // confirmation, which no Safe entry may bypass.
        string[] reservedForE5 =
        {
            "Spooler",
            "XblAuthManager",
            "XblGameSave",
            "XboxGipSvc",
            "XboxNetApiSvc",
        };

        using var catalog = new ShippedCatalog();

        foreach (ITweak tweak in catalog.ServiceTweaks)
        {
            Assert.Equal(RiskTier.Safe, tweak.RiskTier);

            catalog.Runner.Runs.Clear();
            catalog.Runner.EnqueueCapture("Automatic|0\r\n");
            tweak.Capture();

            string read = Assert.Single(catalog.Args);
            foreach (string reserved in reservedForE5)
                Assert.DoesNotContain("Get-Service -Name '" + reserved + "'", read);
        }
    }

    [Fact]
    public void WindowsSearch_IsSelectableButNeverChosenForTheUser()
    {
        // Same judgement that keeps Visual Effects out of the gaming Preset: turning the indexer
        // down degrades Windows Search visibly, which is not a side effect of clicking a curated
        // starting point. Its two siblings carry no such user-facing cost.
        using var catalog = new ShippedCatalog();
        IReadOnlyList<string> gaming = Assert.Single(catalog.Presets).TweakIds;

        Assert.DoesNotContain("services.wSearch", gaming);
        Assert.DoesNotContain("services.wSearch", catalog.Recommended);
        Assert.NotNull(catalog.Find("services.wSearch"));

        foreach (string id in new[] { "services.diagTrack", "services.doSvc" })
            Assert.Contains(id, gaming);

        // Telemetry is the sibling that is still recommended after E7, which is what keeps the
        // `wSearch` exclusion above falsifiable: an empty `Recommended` would satisfy it for the
        // wrong reason. Which ids belong to each curated set is pinned by E7-03, not here.
        Assert.Contains("services.diagTrack", catalog.Recommended);
    }

    // ---- E3-03 — the contract every service Tweak owes -----------------------------------------

    /// <summary>Start types that let a service run earlier than Manual, with sc.exe's own token.</summary>
    private static readonly (string StartType, string ScToken)[] NoisierThanManual =
    {
        ("Automatic", "auto"),
        ("AutomaticDelayedStart", "delayed-auto"),
        ("Boot", "boot"),
        ("System", "system"),
    };

    [Fact]
    public void EveryServiceTweak_RestoresTheStartTypeItFoundRatherThanItsOwnGoal()
    {
        // Driven by the catalog rather than a written list of the four services that exist today:
        // a fifth registered later is covered the moment it is added, including the mistakes a
        // hand-written list cannot see — a service name sc.exe would reject, or a target start
        // type ScTokens has no token for, both of which turn into a Tweak that never applies.
        using var catalog = new ShippedCatalog();

        IReadOnlyList<ITweak> services = catalog.ServiceTweaks;
        Assert.NotEmpty(services);

        foreach (ITweak tweak in services)
        {
            foreach ((string startType, string scToken) in NoisierThanManual)
            {
                catalog.Runner.Runs.Clear();
                catalog.Runner.EnqueueCapture(startType + "\r\n");

                TweakCapture capture = tweak.Capture();
                Assert.True(tweak.Apply(capture), tweak.Id + " could not be applied");
                Assert.True(tweak.Revert(capture), tweak.Id + " could not be reverted");

                string applied = catalog.Args[1];
                string reverted = catalog.Args[2];

                Assert.StartsWith("config ", applied);
                Assert.EndsWith(" start= demand", applied);
                // Same service, and the prior start type put back verbatim — not the goal again.
                Assert.Equal(
                    applied.Replace(" start= demand", " start= " + scToken),
                    reverted
                );
            }
        }
    }

    [Fact]
    public void EveryServiceTweak_LeavesAServiceAlreadyQuietEnoughUntouched()
    {
        // The premise the SysMain finding established, owed by every service entry: a machine that
        // already has the service at or below the goal must come out unchanged, not "optimized"
        // from Disabled back up to Manual.
        using var catalog = new ShippedCatalog();

        foreach (ITweak tweak in catalog.Tweaks.Where(t => t.Kind == TweakKinds.Service))
        {
            foreach (string startType in new[] { "Manual", "Disabled" })
            {
                catalog.Runner.Runs.Clear();
                catalog.Runner.EnqueueCapture(startType + "\r\n");

                Assert.Equal(TweakState.Applied, tweak.Detect());

                catalog.Runner.Runs.Clear();
                catalog.Runner.EnqueueCapture(startType + "\r\n");

                Assert.True(tweak.Apply(tweak.Capture()));
                Assert.DoesNotContain(catalog.Args, arg => arg.StartsWith("config "));
            }
        }
    }

    // ---- E8-02 — Copilot and Recall policies ---------------------------------------------------

    [Fact]
    public void CopilotPolicy_WritesTheUserPolicyKeyAndRemovesItAgainOnRevert()
    {
        // A Policies branch is the one place creating an absent value is the supported mechanism:
        // Windows reads the key whether or not an administrator ever created it. HKCU, because
        // WindowsCopilot.admx declares TurnOffWindowsCopilot as a user policy — read live on
        // 2026-08-23, along with the CSP's own redirect to this key.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak copilot = catalog.Find("windows.copilotPolicy");
        TweakCapture capture = copilot.Capture();

        Assert.True(copilot.Apply(capture));
        Assert.Equal(
            "add \"" + CopilotPolicy + "\" /v \"TurnOffWindowsCopilot\" /t REG_DWORD /d \"1\" /f",
            catalog.Args.Last()
        );

        // Absence is not a zero. Writing 0 would leave the policy behind, saying "Copilot is
        // explicitly allowed" where the machine had said nothing at all.
        catalog.Runner.Runs.Clear();
        Assert.True(copilot.Revert(capture));
        Assert.Equal(
            "delete \"" + CopilotPolicy + "\" /v \"TurnOffWindowsCopilot\" /f",
            Assert.Single(catalog.Args)
        );
    }

    [Theory]
    [InlineData("windows.copilotPolicy", CopilotPolicy, "TurnOffWindowsCopilot")]
    [InlineData("network.deliveryOptimization", DeliveryPolicy, "DODownloadMode")]
    public void PolicyTweaks_RoundTripAPolicyKeyThatDoesNotExistAtAll(
        string id,
        string key,
        string valueName
    )
    {
        // The normal state of a `Policies` branch, and the one the other tests miss: no
        // `KeyReadsBack()`, because nobody has ever created the key. Both reg queries fail, the
        // whole-key export fails with them, and the capture has no archive to fall back on — so the
        // prior state has to be recorded as "every value absent" or Revert has nothing to restore
        // and the policy stays applied for good.
        using var catalog = new ShippedCatalog();

        ITweak tweak = catalog.Find(id);
        TweakCapture tweakCapture = tweak.Capture();

        // NotEmpty first: an empty capture satisfies Assert.All vacuously, and an empty capture is
        // precisely the bug.
        Assert.NotEmpty(tweakCapture.Values);
        Assert.All(tweakCapture.Values, value => Assert.False(value.Existed));

        // No export attempt: `reg export` of a key that is not there fails, and the failure is
        // logged to the user as an error next to a step that succeeded. Verified on a real machine
        // on 2026-08-23 — the applied batch showed a red "could not find the registry key" line
        // above its own success.
        Assert.DoesNotContain(catalog.Args, arg => arg.StartsWith("export "));
        Assert.Equal(string.Empty, tweakCapture.ArtifactFile);
        Assert.True(tweak.Apply(tweakCapture));

        catalog.Runner.Runs.Clear();
        Assert.True(tweak.Revert(tweakCapture));
        // The exact sequence, not just the first command: a test that pinned only the delete would
        // stay green if a stray destructive command were appended after it. The query is the
        // leftover-key check (#51); it finds nothing readable here, so no key is removed.
        Assert.Equal(
            new[] { "delete \"" + key + "\" /v \"" + valueName + "\" /f", "query \"" + key + "\"" },
            catalog.Args
        );
    }

    [Fact]
    public void PolicyTweaks_RemoveThePolicyKeyTheyCreatedWhenNothingElseIsLeftInIt()
    {
        // #51. Apply creates the key along with the value, so leaving the key behind after Revert
        // is an artefact the app made and did not clean up. Verified on a real machine on
        // 2026-08-23: after reverting Delivery Optimization, `reg query` on the key returned exit 0
        // and a single empty line — the key still there, holding nothing.
        using var catalog = new ShippedCatalog();

        ITweak delivery = catalog.Find("network.deliveryOptimization");
        TweakCapture capture = delivery.Capture();
        Assert.True(delivery.Apply(capture));

        catalog.Runner.Runs.Clear();
        catalog.KeyIsEmpty();

        Assert.True(delivery.Revert(capture));
        Assert.Equal(
            new[]
            {
                "delete \"" + DeliveryPolicy + "\" /v \"DODownloadMode\" /f",
                "query \"" + DeliveryPolicy + "\"",
                "delete \"" + DeliveryPolicy + "\" /f",
            },
            catalog.Args
        );
    }

    [Fact]
    public void PolicyTweaks_LeaveAKeyAloneWhenSomeoneElsesPolicyIsStillInIt()
    {
        // The trap. Between Apply and Revert an administrator may have set another policy under the
        // same branch. Deleting the branch wholesale would destroy their setting — a far worse bug
        // than the leftover key this fixes.
        using var catalog = new ShippedCatalog();

        ITweak delivery = catalog.Find("network.deliveryOptimization");
        TweakCapture capture = delivery.Capture();
        Assert.True(delivery.Apply(capture));

        catalog.Runner.Runs.Clear();
        catalog.Value("DOMaxCacheSize", "REG_DWORD", "0x14");

        Assert.True(delivery.Revert(capture));

        // The exact sequence, so the test tells "checked and declined" apart from "never checked".
        // A DoesNotContain on its own passes for both, and only one of them is the guard.
        Assert.Equal(
            new[]
            {
                "delete \"" + DeliveryPolicy + "\" /v \"DODownloadMode\" /f",
                "query \"" + DeliveryPolicy + "\"",
            },
            catalog.Args
        );
    }

    [Fact]
    public void PolicyTweaks_LeaveAKeyAloneWhenOnlyASubkeyIsLeftInIt()
    {
        // A subkey is data too, and it is the case the emptiness read has to distinguish by shape:
        // an empty key answers with nothing at all, while a key holding only subkeys answers with
        // its own path and a line per subkey.
        using var catalog = new ShippedCatalog();

        ITweak delivery = catalog.Find("network.deliveryOptimization");
        TweakCapture capture = delivery.Capture();
        Assert.True(delivery.Apply(capture));

        catalog.Runner.Runs.Clear();
        catalog.Runner.EnqueueCapture(
            "\r\n" + DeliveryPolicy.Replace("HKLM", "HKEY_LOCAL_MACHINE") + "\\SomeSubkey\r\n\r\n"
        );

        Assert.True(delivery.Revert(capture));
        Assert.Equal(
            new[]
            {
                "delete \"" + DeliveryPolicy + "\" /v \"DODownloadMode\" /f",
                "query \"" + DeliveryPolicy + "\"",
            },
            catalog.Args
        );
    }

    [Fact]
    public void PolicyTweaks_NeverRemoveAKeyThatWasAlreadyThereBeforeTheyRan()
    {
        // The key existing beforehand is someone else's decision, whether or not it is empty now.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak delivery = catalog.Find("network.deliveryOptimization");
        TweakCapture capture = delivery.Capture();
        Assert.True(delivery.Apply(capture));

        catalog.Runner.Runs.Clear();
        Assert.True(delivery.Revert(capture));

        Assert.Equal(
            "delete \"" + DeliveryPolicy + "\" /v \"DODownloadMode\" /f",
            Assert.Single(catalog.Args)
        );
    }

    [Fact]
    public void Recall_RoundTripsAPolicyKeyThatDoesNotExistAtAll()
    {
        // Same case, through the support gate: the probe is answered only after the capture, so the
        // capture's reg queries are the ones that find nothing.
        using var catalog = new ShippedCatalog();

        const string key = WindowsAiPolicy;
        const string valueName = "DisableAIDataAnalysis";

        ITweak recall = catalog.Find("windows.recall");
        TweakCapture capture = recall.Capture();
        Assert.NotEmpty(capture.Values);
        Assert.All(capture.Values, value => Assert.False(value.Existed));

        catalog.FeaturePresent();
        Assert.True(recall.Apply(capture));

        catalog.Runner.Runs.Clear();
        Assert.True(recall.Revert(capture));
        // The exact sequence, not just the first command: a test that pinned only the delete would
        // stay green if a stray destructive command were appended after it. The query is the
        // leftover-key check (#51); it finds nothing readable here, so no key is removed.
        Assert.Equal(
            new[] { "delete \"" + key + "\" /v \"" + valueName + "\" /f", "query \"" + key + "\"" },
            catalog.Args
        );
    }

    [Fact]
    public void Recall_ReportsUnsupportedWhereWindowsDoesNotHaveTheFeature()
    {
        // The reason TweakState.Unsupported exists. Without it the row says "Not applied", the user
        // ticks it, the policy write succeeds, and the next refresh says "Applied" for a feature
        // that is not on the machine.
        using var catalog = new ShippedCatalog();
        catalog.FeatureAbsent();

        Assert.Equal(TweakState.Unsupported, catalog.Find("windows.recall").Detect());
    }

    [Fact]
    public void Recall_AsksTheOptionalFeatureListRatherThanThePolicysOwnAbsence()
    {
        // An unset policy on a Copilot+ PC and a machine that has never had Recall are the same
        // bytes. Only the capability tells them apart, so the probe has to be the thing that runs.
        using var catalog = new ShippedCatalog();
        catalog.FeatureAbsent();

        catalog.Find("windows.recall").Detect();

        string probe = Assert.Single(catalog.Args);
        Assert.Contains("Win32_OptionalFeature", probe);
        Assert.Contains("'Recall'", probe);
        Assert.DoesNotContain("DisableAIDataAnalysis", probe);
    }

    [Fact]
    public void Recall_DetectsAndAppliesNormallyOnAMachineThatHasIt()
    {
        using var catalog = new ShippedCatalog();
        catalog.FeaturePresent();
        catalog.Value("DisableAIDataAnalysis", "REG_DWORD", "0x1");

        ITweak recall = catalog.Find("windows.recall");
        Assert.Equal(TweakState.Applied, recall.Detect());

        catalog.Runner.Runs.Clear();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();
        TweakCapture capture = recall.Capture();

        Assert.True(recall.Apply(capture));
        Assert.Equal(
            "add \"" + WindowsAiPolicy + "\" /v \"DisableAIDataAnalysis\" /t REG_DWORD /d \"1\" /f",
            catalog.Args.Last()
        );
    }

    [Fact]
    public void Recall_RefusesToApplyOnAMachineWithoutTheFeatureEvenWhenAskedDirectly()
    {
        // Detect is advice; this is the refusal. A caller that never asked — a stale IPC payload, a
        // Preset applied headlessly — must not be able to write the policy anyway.
        using var catalog = new ShippedCatalog();
        catalog.FeatureAbsent();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak recall = catalog.Find("windows.recall");
        TweakCapture capture = recall.Capture();
        catalog.Runner.Runs.Clear();

        Assert.False(recall.Apply(capture));
        Assert.DoesNotContain(catalog.Args, arg => arg.StartsWith("add "));
    }

    [Fact]
    public void Recall_StillRevertsWhatItAppliedAfterTheFeatureIsGone()
    {
        // A capture only exists because the Tweak was applied while the feature was there. Gating
        // Revert on support would strand the user with a policy they can no longer take back.
        using var catalog = new ShippedCatalog();
        catalog.FeatureAbsent();

        var capture = new TweakCapture(
            "windows.recall",
            TweakKinds.Registry,
            "2026-08-23T10:00:00.0000000Z",
            new[] { new CapturedValue("DisableAIDataAnalysis", "REG_DWORD", "", false) }
        );

        Assert.True(catalog.Find("windows.recall").Revert(capture));
        Assert.Equal(
            "delete \"" + WindowsAiPolicy + "\" /v \"DisableAIDataAnalysis\" /f",
            Assert.Single(catalog.Args)
        );
    }

    // ---- E8-03 — Game DVR capture and transparency ----------------------------------------------

    [Theory]
    [InlineData("0x0", TweakState.Applied)]
    [InlineData("0x1", TweakState.NotApplied)] // what the verified machine ships with
    public void GameDvrCapture_DetectsTheValueGameConfigStoreActuallyHolds(
        string live,
        TweakState expected
    )
    {
        using var catalog = new ShippedCatalog();
        catalog.Value("GameDVR_Enabled", "REG_DWORD", live);

        Assert.Equal(expected, catalog.Find("graphics.gameDvrCapture").Detect());
        Assert.All(catalog.Args, arg => Assert.Contains(GameConfigStore, arg));
    }

    [Fact]
    public void GameDvrCapture_RoundTripsTheValueAndTouchesNothingElse()
    {
        // Game Bar, ShowStartupPanel and the Xbox services are deliberately out of scope: turning
        // off background capture is not the same as taking the overlay away from someone using a
        // controller.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("GameDVR_Enabled", "REG_DWORD", "0x1");

        ITweak capture_ = catalog.Find("graphics.gameDvrCapture");
        TweakCapture capture = capture_.Capture();

        Assert.True(capture_.Apply(capture));
        Assert.Equal(
            "add \"" + GameConfigStore + "\" /v \"GameDVR_Enabled\" /t REG_DWORD /d \"0\" /f",
            catalog.Args.Last()
        );

        catalog.Runner.Runs.Clear();
        Assert.True(capture_.Revert(capture));
        Assert.Contains("/d \"0x1\"", Assert.Single(catalog.Args));

        Assert.DoesNotContain(catalog.Args, arg => arg.Contains("GameBar", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(catalog.Args, arg => arg.Contains("Xbox", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Transparency_RoundTripsTheSwitchWindowsSettingsWrites()
    {
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value("EnableTransparency", "REG_DWORD", "0x1");

        ITweak transparency = catalog.Find("system.transparency");
        TweakCapture capture = transparency.Capture();

        Assert.True(transparency.Apply(capture));
        Assert.Equal(
            "add \"" + Personalize + "\" /v \"EnableTransparency\" /t REG_DWORD /d \"0\" /f",
            catalog.Args.Last()
        );

        catalog.Runner.Runs.Clear();
        Assert.True(transparency.Revert(capture));
        Assert.Contains("/d \"0x1\"", Assert.Single(catalog.Args));
    }

    [Theory]
    [InlineData("graphics.gameDvrCapture")]
    [InlineData("system.transparency")]
    public void SettingsBackedTweaks_RefuseToCreateAValueTheBuildDoesNotExpose(string id)
    {
        // Neither writes under a `Policies` branch, so the exception that lets the Copilot, Recall
        // and Delivery Optimization entries create an absent value does not apply here: Windows
        // owns these two, and an absent one means this build does not offer the switch. Both were
        // present on the machine they were verified against; this is the other machine.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak tweak = catalog.Find(id);
        TweakCapture capture = tweak.Capture();
        catalog.Runner.Runs.Clear();

        Assert.False(tweak.Apply(capture));
        Assert.Empty(catalog.Args);
    }

    [Fact]
    public void Transparency_NeedsNoRestartAndIsThereforeRecommendable()
    {
        // DWM picks the change up immediately, which is what lets it sit in `Recommended` at all.
        using var catalog = new ShippedCatalog();

        Assert.False(catalog.Find("system.transparency").RequiresReboot);
        Assert.Contains("system.transparency", catalog.Recommended);
    }

    // ---- E8-04 — Startup ads and Delivery Optimization -------------------------------------------

    /// <summary>The four suggestion values, in the order the Tweak queries them.</summary>
    private static readonly string[] AdValues =
    {
        "SystemPaneSuggestionsEnabled",
        "RotatingLockScreenOverlayEnabled",
        "SoftLandingEnabled",
        "SilentInstalledAppsEnabled",
    };

    [Fact]
    public void StartupAds_ReportsAppliedOnlyWhenEverySuggestionIsOff()
    {
        using var catalog = new ShippedCatalog();
        foreach (string name in AdValues) catalog.Value(name, "REG_DWORD", "0x0");

        Assert.Equal(TweakState.Applied, catalog.Find("windows.startupAds").Detect());
        Assert.All(catalog.Args, arg => Assert.Contains(ContentDelivery, arg));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void StartupAds_ReportsPartialWhenExactlyOneSuggestionIsStillOn(int stillOn)
    {
        // Four values behind one row, which is what Partial exists for: rounding this to "applied"
        // would tell the user the ads are gone while one of them still shows.
        using var catalog = new ShippedCatalog();
        for (int index = 0; index < AdValues.Length; index++)
            catalog.Value(AdValues[index], "REG_DWORD", index == stillOn ? "0x1" : "0x0");

        Assert.Equal(TweakState.Partial, catalog.Find("windows.startupAds").Detect());
    }

    [Fact]
    public void StartupAds_RefusesToCreateASuggestionValueTheMachineDoesNotExpose()
    {
        // Not a Policies branch: these are the values Windows writes for its own Settings switches,
        // so an absent one is a switch this build does not have and creating it would write
        // something nothing reads.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.Value(AdValues[0], "REG_DWORD", "0x1");
        catalog.Value(AdValues[1], "REG_DWORD", "0x1");
        catalog.ValueAbsent();
        catalog.Value(AdValues[3], "REG_DWORD", "0x1");

        ITweak ads = catalog.Find("windows.startupAds");
        TweakCapture capture = ads.Capture();
        catalog.Runner.Runs.Clear();

        Assert.False(ads.Apply(capture));
        Assert.Empty(catalog.Args);
    }

    [Fact]
    public void StartupAds_RoundTripsEveryValueItOwns()
    {
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        foreach (string name in AdValues) catalog.Value(name, "REG_DWORD", "0x1");

        ITweak ads = catalog.Find("windows.startupAds");
        TweakCapture capture = ads.Capture();

        Assert.True(ads.Apply(capture));
        Assert.Equal(
            AdValues,
            catalog.Args
                .Where(arg => arg.StartsWith("add "))
                .Select(arg => arg.Split(" /v \"")[1].Split('"')[0])
        );

        catalog.Runner.Runs.Clear();
        Assert.True(ads.Revert(capture));
        Assert.Equal(
            new[] { "/d \"0x1\"", "/d \"0x1\"", "/d \"0x1\"", "/d \"0x1\"" },
            catalog.Args.Select(Payload)
        );
    }

    [Fact]
    public void DeliveryOptimization_SetsTheHttpOnlyModeAndRestoresTheAbsentPolicy()
    {
        // 0 is "HTTP only, no peering", quoted from this build's own DeliveryOptimization.adml on
        // 2026-08-23. Content keeps coming from Microsoft; what stops is this PC uploading it.
        using var catalog = new ShippedCatalog();
        catalog.KeyReadsBack();
        catalog.ValueAbsent();

        ITweak delivery = catalog.Find("network.deliveryOptimization");
        TweakCapture capture = delivery.Capture();

        Assert.True(delivery.Apply(capture));
        Assert.Equal(
            "add \"" + DeliveryPolicy + "\" /v \"DODownloadMode\" /t REG_DWORD /d \"0\" /f",
            catalog.Args.Last()
        );

        catalog.Runner.Runs.Clear();
        Assert.True(delivery.Revert(capture));
        Assert.Equal(
            "delete \"" + DeliveryPolicy + "\" /v \"DODownloadMode\" /f",
            Assert.Single(catalog.Args)
        );
    }

    [Fact]
    public void DoSvc_KeepsWorkingAlongsideTheDeliveryOptimizationPolicy()
    {
        // E8-04 replaces the mechanism, not the entry. Removing services.doSvc would strand anyone
        // who applied it: RevertTweak resolves through Find, and the two are different settings
        // that happen to share a goal.
        using var catalog = new ShippedCatalog();

        Assert.NotNull(catalog.Find("services.doSvc"));
        Assert.NotNull(catalog.Find("network.deliveryOptimization"));
        Assert.NotEqual(
            catalog.Find("services.doSvc").Kind,
            catalog.Find("network.deliveryOptimization").Kind
        );
    }

    // ---- Cross-cutting -------------------------------------------------------------------------

    [Fact]
    public void GamingPreset_HoldsNothingThatRefusesToApplyOnAnOrdinaryMachine()
    {
        // A Preset is applied wholesale by the scheduler, with nobody there to read a row. GPU
        // Hardware Scheduling refuses where Windows never exposed HwSchMode — the common case — so
        // including it would make every headless --task=gaming run report failure.
        using var catalog = new ShippedCatalog();

        Assert.DoesNotContain(
            "graphics.hardwareScheduling",
            Assert.Single(catalog.Presets).TweakIds
        );
        Assert.NotNull(catalog.Find("graphics.hardwareScheduling"));
    }

    [Fact]
    public void EveryTweak_DetectsWithoutWritingAnything()
    {
        // Detect runs on every catalog load, including the one the screen triggers on navigation.
        // A Tweak that mutated while reading would change the machine just by opening a tab.
        using var catalog = new ShippedCatalog();

        foreach (ITweak tweak in catalog.Tweaks) tweak.Detect();

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
    private const string GameConfigStore = @"HKCU\System\GameConfigStore";
    private const string Personalize =
        @"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    private const string ContentDelivery =
        @"HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager";
    private const string CopilotPolicy =
        @"HKCU\Software\Policies\Microsoft\Windows\WindowsCopilot";
    private const string WindowsAiPolicy = @"HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsAI";
    private const string DeliveryPolicy =
        @"HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization";

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
