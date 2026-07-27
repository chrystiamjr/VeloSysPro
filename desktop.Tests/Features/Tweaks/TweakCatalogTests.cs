using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class TweakCatalogTests
{
    private sealed class StubTweak : ITweak
    {
        public StubTweak(string id, RiskTier riskTier = RiskTier.Safe)
        {
            Id = id;
            RiskTier = riskTier;
        }

        public string Id { get; }
        public string Category => TweakCategories.Cpu;
        public RiskTier RiskTier { get; }
        public string Kind => TweakKinds.Registry;

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
        // The scheduler runs VeloSysPro.exe --task=quick; naming the Preset after the task keeps
        // the two vocabularies from drifting as the catalog grows.
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Preset preset = Assert.Single(catalog.Presets);
        Assert.Equal("quick", preset.Id);
        Assert.Equal(catalog.Tweaks.Select(tweak => tweak.Id).OrderBy(id => id), preset.TweakIds.OrderBy(id => id));
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
    public void CreateDefault_SeedsOneTweakPerRevertMechanism()
    {
        TweakCatalog catalog = TweakCatalog.CreateDefault(
            new FakeCommandRunner(),
            NewBackupManager()
        );

        Assert.Equal(
            new[] { TweakKinds.Bcd, TweakKinds.Registry, TweakKinds.Service },
            catalog.Tweaks.Select(tweak => tweak.Kind).Distinct().OrderBy(kind => kind)
        );
    }

    private static RegistryBackupManager NewBackupManager()
    {
        var temp = new TemporaryDirectory();
        var runner = new FakeCommandRunner();
        return new RegistryBackupManager(temp.Path, runner, new RecordingStatusSink(), temp.Path);
    }
}
