using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class TweakCatalogTests
{
    private sealed class StubTweak : ITweak
    {
        public StubTweak(string id, RiskTier riskTier = RiskTier.Safe, bool requiresReboot = false)
        {
            Id = id;
            RiskTier = riskTier;
            RequiresReboot = requiresReboot;
        }

        public string Id { get; }
        public string Category => TweakCategories.Cpu;
        public RiskTier RiskTier { get; }
        public string Kind => TweakKinds.Registry;
        public bool RequiresReboot { get; }

        public TweakState Detect() => TweakState.NotApplied;

        public IReadOnlyList<CapturedValue> ReadCurrentValues() => new CapturedValue[0];

        public TweakCapture Capture() => new(Id, Kind, "", ReadCurrentValues());

        public bool Apply(TweakCapture capture) => true;

        public bool Revert(TweakCapture capture) => true;
    }

    private static TweakCatalog Catalog(
        IReadOnlyList<ITweak> tweaks,
        params (string Preset, string[] Ids)[] presets
    ) =>
        new(
            tweaks,
            presets.ToDictionary(
                preset => preset.Preset,
                preset => (IReadOnlyList<string>)preset.Ids
            )
        );

    [Fact]
    public void Find_ResolvesARegisteredTweakById()
    {
        var tweak = new StubTweak("cpu.a");
        TweakCatalog catalog = Catalog(new ITweak[] { tweak, new StubTweak("cpu.b") });

        Assert.Same(tweak, catalog.Find("cpu.a"));
        Assert.Null(catalog.Find("cpu.missing"));
    }

    [Fact]
    public void Constructor_RejectsAPresetThatReferencesAnAdvancedTweak()
    {
        // A Preset is what a non-expert clicks; a security-reducing Tweak must never ride along
        // (docs/adr/0005-advanced-risk-tier.md).
        var tweaks = new ITweak[]
        {
            new StubTweak("cpu.a"),
            new StubTweak("advanced.memoryIntegrity", RiskTier.Advanced),
        };

        ArgumentException error = Assert.Throws<ArgumentException>(
            () => Catalog(tweaks, ("quick", new[] { "cpu.a", "advanced.memoryIntegrity" }))
        );
        Assert.Contains("advanced.memoryIntegrity", error.Message);
    }

    [Fact]
    public void Constructor_RejectsAPresetThatReferencesAnUnknownTweak()
    {
        Assert.Throws<ArgumentException>(
            () => Catalog(new ITweak[] { new StubTweak("cpu.a") }, ("quick", new[] { "cpu.typo" }))
        );
    }

    [Fact]
    public void Constructor_RejectsDuplicateTweakIds()
    {
        Assert.Throws<ArgumentException>(
            () => Catalog(new ITweak[] { new StubTweak("cpu.a"), new StubTweak("cpu.a") })
        );
    }

    [Fact]
    public void Constructor_RejectsRecommendingAnAdvancedTweak()
    {
        // Recommended is one click for someone who will not read the list, so it carries the same
        // rule as a Preset: nothing that reduces security rides along.
        var tweaks = new ITweak[]
        {
            new StubTweak("cpu.a"),
            new StubTweak("advanced.memoryIntegrity", RiskTier.Advanced),
        };

        ArgumentException error = Assert.Throws<ArgumentException>(
            () =>
                new TweakCatalog(
                    tweaks,
                    new Dictionary<string, IReadOnlyList<string>>(),
                    new[] { "advanced.memoryIntegrity" }
                )
        );
        Assert.Contains("advanced.memoryIntegrity", error.Message);
    }

    [Fact]
    public void Constructor_RejectsRecommendingATweakThatNeedsARestart()
    {
        // Recommended is one click that should just work. A Tweak whose effect only arrives after a
        // reboot makes the click a lie unless the user notices a condition — so the rule that used
        // to live in a comment beside the shipped list is enforced for every catalog.
        var tweaks = new ITweak[]
        {
            new StubTweak("cpu.a"),
            new StubTweak("boot.disableDynamicTick", requiresReboot: true),
        };

        ArgumentException error = Assert.Throws<ArgumentException>(
            () =>
                new TweakCatalog(
                    tweaks,
                    new Dictionary<string, IReadOnlyList<string>>(),
                    new[] { "cpu.a", "boot.disableDynamicTick" }
                )
        );
        Assert.Contains("boot.disableDynamicTick", error.Message);
    }

    [Fact]
    public void Constructor_RejectsRecommendingAnUnknownTweak()
    {
        Assert.Throws<ArgumentException>(
            () =>
                new TweakCatalog(
                    new ITweak[] { new StubTweak("cpu.a") },
                    new Dictionary<string, IReadOnlyList<string>>(),
                    new[] { "cpu.typo" }
                )
        );
    }

    [Fact]
    public void CreateDefault_RecommendsOnlyTheTweaksThatNeedNoRestart()
    {
        // A recommendation should not carry a condition the user has to notice.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Assert.DoesNotContain("boot.disableDynamicTick", catalog.Recommended);
        Assert.NotEmpty(catalog.Recommended);
        Assert.All(catalog.Recommended, id => Assert.Equal(RiskTier.Safe, catalog.Find(id)!.RiskTier));
    }

    [Fact]
    public void Presets_CarryTheirSelectionForTheFrontendToApply()
    {
        TweakCatalog catalog = Catalog(
            new ITweak[] { new StubTweak("cpu.a"), new StubTweak("cpu.b") },
            ("quick", new[] { "cpu.a" })
        );

        Preset preset = Assert.Single(catalog.Presets);
        Assert.Equal("quick", preset.Id);
        Assert.Equal(new[] { "cpu.a" }, preset.TweakIds);
    }

    [Fact]
    public void CreateDefault_KeysItsPresetsByTheHeadlessCliTaskNames()
    {
        // The scheduler runs VeloSysPro.exe --task=gaming; naming the Preset after the task is what
        // lets entries written against the old, unrevertable Gaming Plan keep working.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Preset preset = Assert.Single(catalog.Presets);
        Assert.Equal("gaming", preset.Id);
        Assert.All(preset.TweakIds, id => Assert.NotNull(catalog.Find(id)));
    }

    [Fact]
    public void CreateDefault_NeverNamesAPresetAfterAnOptimizationPlan()
    {
        // Both vocabularies reach the same --task= argument, so a shared name would make the
        // scheduler's intent ambiguous — App.RunHeadless resolves Presets first, and the Plan
        // would silently become unreachable.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        foreach (Preset preset in catalog.Presets)
        {
            Assert.False(
                Enum.TryParse(preset.Id, ignoreCase: true, out OptimizationPlan _),
                "Preset '" + preset.Id + "' shadows an OptimizationPlan of the same name."
            );
        }
    }

    [Fact]
    public void CreateDefault_KeepsVisualEffectsOutOfTheGamingPreset()
    {
        // It rewrites how Windows looks, which is not a side effect of clicking "gaming".
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Assert.NotNull(catalog.Find("system.visualEffects"));
        Assert.DoesNotContain(
            "system.visualEffects",
            Assert.Single(catalog.Presets).TweakIds
        );
    }

    [Fact]
    public void CreateDefault_GivesEveryTweakADottedIdThatStartsWithItsCategory()
    {
        // The frontend translates a Tweak by its id — `optimize.tweak.<id>.title` — so the id is
        // also an i18n path. A row whose id and category disagree would land its copy under the
        // wrong parent and render the raw key.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Assert.NotEmpty(catalog.Tweaks);
        foreach (ITweak tweak in catalog.Tweaks)
        {
            Assert.StartsWith(tweak.Category + ".", tweak.Id);
            Assert.Equal(2, tweak.Id.Split('.').Length);
        }
    }

    [Fact]
    public void CreateDefault_ExposesOnlySafeTweaksInsidePresets()
    {
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        foreach (Preset preset in catalog.Presets)
        {
            foreach (string id in preset.TweakIds)
            {
                Assert.Equal(RiskTier.Safe, catalog.Find(id)!.RiskTier);
            }
        }
    }

    [Fact]
    public void CreateDefault_CoversEveryRevertMechanism()
    {
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Assert.Equal(
            new[] { TweakKinds.Bcd, TweakKinds.Power, TweakKinds.Registry, TweakKinds.Service },
            catalog.Tweaks.Select(tweak => tweak.Kind).Distinct().OrderBy(kind => kind)
        );
    }

    [Fact]
    public void CreateDefault_PutsTheMmcssValuesWhereWindowsActuallyKeepsThem()
    {
        // The source guides — and this epic's own ticket — place MMCSS under
        // SYSTEM\CurrentControlSet\Control\Multimedia. That key does not exist on Windows 11
        // (verified 2026-07-27), so writing there would have created a key nothing reads and every
        // one of these Tweaks would have reported success while changing nothing.
        var runner = new FakeCommandRunner();
        TweakCatalog catalog = TweakCatalog.CreateDefault(runner, NewBackupManager());

        foreach (string id in new[] { "cpu.systemResponsiveness", "network.throttlingIndex", "cpu.gamesTaskPriority" })
        {
            runner.Runs.Clear();
            catalog.Find(id)!.Detect();

            Assert.All(
                runner.Runs,
                run =>
                    Assert.Contains(
                        @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                        run.Args
                    )
            );
        }
    }

    [Fact]
    public void CreateDefault_PinsTheCuratedSetsToADecisionSomeoneWroteDown()
    {
        // `Recommended` reached eight entries without anyone deciding it should: each addition was
        // locally reasonable and the set was never reviewed as a whole. E7 rebuilt both sets against
        // primary sources; this test is what makes the next addition a decision instead of a habit.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        AssertCuratedSet(
            "`Recommended`",
            new[] { "graphics.gameMode", "services.diagTrack" },
            catalog.Recommended
        );

        AssertCuratedSet(
            "The `gaming` Preset",
            new[]
            {
                "cpu.win32PrioritySeparation",
                "cpu.systemResponsiveness",
                "network.throttlingIndex",
                "graphics.fullscreenExclusive",
                "graphics.gameMode",
                "system.powerPlan",
                "services.sysMain",
                "services.diagTrack",
                "services.doSvc",
            },
            // By id, not Assert.Single: a second Preset arriving is a different decision, and
            // failing on the count here would report it as a curated-set drift.
            Assert.Single(catalog.Presets, preset => preset.Id == "gaming").TweakIds
        );
    }

    /// <summary>
    /// Sequence equality carrying the reason the set is pinned. xUnit's <c>Assert.Equal</c> has no
    /// message overload, and an unexplained failure here reads as a stale test rather than as the
    /// question it is meant to ask.
    /// </summary>
    private static void AssertCuratedSet(
        string name,
        IReadOnlyList<string> expected,
        IReadOnlyList<string> actual
    )
    {
        Assert.True(
            expected.SequenceEqual(actual),
            name
                + " is curated, not incidental — E7-03 pins it so that changing it is a decision "
                + "someone writes down. Nothing joins `Recommended` without a primary source for the "
                + "gain it claims, and nothing joins `gaming` that Windows does not act on. If this "
                + "change is deliberate, record why and update the list here."
                + Environment.NewLine
                + "Expected: "
                + string.Join(", ", expected)
                + Environment.NewLine
                + "Actual:   "
                + string.Join(", ", actual)
        );
    }

    /// <summary>
    /// Written out rather than read from the catalog: a list derived from the live catalog would
    /// agree with any deletion and prove nothing. These are the seventeen ids `v0.2.0` shipped.
    /// </summary>
    private static readonly string[] V020TweakIds =
    {
        "boot.disableDynamicTick",
        "boot.platformClock",
        "boot.platformTick",
        "cpu.gamesTaskPriority",
        "cpu.systemResponsiveness",
        "cpu.win32PrioritySeparation",
        "graphics.fullscreenExclusive",
        "graphics.gameMode",
        "graphics.hardwareScheduling",
        "network.tcpParameters",
        "network.throttlingIndex",
        "services.diagTrack",
        "services.doSvc",
        "services.sysMain",
        "services.wSearch",
        "system.powerPlan",
        "system.visualEffects",
    };

    [Fact]
    public void CreateDefault_StillResolvesEveryTweakEverShipped()
    {
        // Demoting a Tweak means removing it from the curated sets, never from the catalog.
        // RevertTweak resolves through Find, so a deleted id returns null and anyone who applied
        // that Tweak on v0.2.0 is stuck with it for good — the one failure this epic must not cause.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        foreach (string id in V020TweakIds)
        {
            Assert.True(
                catalog.Find(id) is not null,
                "Tweak '"
                    + id
                    + "' shipped in v0.2.0 and no longer resolves. Users who applied it cannot "
                    + "revert it: RevertTweak calls TweakCatalog.Find, which now returns null. "
                    + "Leave the Tweak in the catalog and take it out of the curated sets instead."
            );
        }
    }

    private static RegistryBackupManager NewBackupManager()
    {
        var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        return new RegistryBackupManager(temp.Path, runner, new RecordingStatusSink(), temp.Path);
    }
}
