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

    private static RegistryBackupManager NewBackupManager()
    {
        var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        return new RegistryBackupManager(temp.Path, runner, new RecordingStatusSink(), temp.Path);
    }
}
