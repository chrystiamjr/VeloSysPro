using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Xunit;

namespace VeloSysPro.Tests;

public class TweakEngineTests
{
    private sealed class SpyTweak : ITweak
    {
        public SpyTweak(string id, bool applies = true, bool reverts = true)
        {
            Id = id;
            _applies = applies;
            _reverts = reverts;
        }

        private readonly bool _applies;
        private readonly bool _reverts;

        public string Id { get; }
        public string Category => TweakCategories.Cpu;
        public RiskTier RiskTier => RiskTier.Safe;
        public string Kind => TweakKinds.Registry;
        public TweakState DetectedState { get; set; } = TweakState.NotApplied;
        public List<string> Calls { get; } = new();

        public TweakState Detect() => DetectedState;

        public TweakCapture Capture()
        {
            Calls.Add("capture");
            return new TweakCapture(Id, Kind, "2026-07-25T10:00:00.0000000Z",
                new[] { new CapturedValue("Value", "REG_DWORD", "0x2", true) });
        }

        public bool Apply(TweakCapture capture)
        {
            Calls.Add("apply");
            return _applies;
        }

        public bool Revert(TweakCapture capture)
        {
            Calls.Add("revert");
            return _reverts;
        }
    }

    private sealed class RecordingCaptureStore : ITweakCaptureStore
    {
        public List<TweakCapture> Saved { get; } = new();
        public Dictionary<string, TweakCapture> Latest { get; } = new(StringComparer.Ordinal);

        public void Save(TweakCapture capture)
        {
            Saved.Add(capture);
            Latest[capture.TweakId] = capture;
        }

        public TweakCapture? LoadLatest(string tweakId) =>
            Latest.TryGetValue(tweakId, out TweakCapture? capture) ? capture : null;
    }

    private sealed class InMemorySnapshotStore : ISnapshotStore
    {
        public List<OptimizationSnapshot> Snapshots { get; } = new();

        public void Append(OptimizationSnapshot snapshot) => Snapshots.Add(snapshot);

        public IReadOnlyList<OptimizationSnapshot> ReadAll() => Snapshots;
    }

    private sealed class Harness
    {
        public FakeCommandRunner Runner { get; } = new();
        public RecordingStatusSink Sink { get; } = new();
        public RecordingCaptureStore Captures { get; } = new();
        public InMemorySnapshotStore History { get; } = new();
        public TweakEngine Engine { get; }

        public Harness(params ITweak[] tweaks)
            : this(new Dictionary<string, IReadOnlyList<string>>(), tweaks) { }

        public Harness(IReadOnlyDictionary<string, IReadOnlyList<string>> presets, params ITweak[] tweaks)
        {
            Engine = new TweakEngine(
                new TweakCatalog(tweaks, presets),
                Captures,
                new SystemRestoreManager(Runner, Sink),
                new SnapshotManager(Runner, Sink),
                History,
                Sink
            );
        }
    }

    [Fact]
    public void ApplyTweaks_CreatesTheRestorePointBeforeAnyTweakIsApplied()
    {
        var tweak = new SpyTweak("cpu.a");
        var harness = new Harness(tweak);

        Assert.True(harness.Engine.ApplyTweaks(new[] { "cpu.a" }).Ok);

        int restorePointIndex = harness.Runner.Runs.FindIndex(
            run => run.Args.Contains("Checkpoint-Computer")
        );
        Assert.True(restorePointIndex >= 0, "a Safety Checkpoint must be created");
        Assert.Equal(new[] { "capture", "apply" }, tweak.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.checkpointCreated");
    }

    [Fact]
    public void ApplyTweaks_CreatesExactlyOneRestorePointForTheWholeBatch()
    {
        var harness = new Harness(new SpyTweak("cpu.a"), new SpyTweak("cpu.b"));

        harness.Engine.ApplyTweaks(new[] { "cpu.a", "cpu.b" });

        Assert.Single(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
    }

    [Fact]
    public void ApplyTweaks_RespectsTheSafetyBackupPreference()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Engine.CreateSafetyBackupEnabled = false;

        Assert.True(harness.Engine.ApplyTweaks(new[] { "cpu.a" }).Ok);

        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.checkpointSkipped");
    }

    [Fact]
    public void ApplyTweaks_StopsWithoutTouchingTheSystemWhenTheCheckpointCannotBeCreated()
    {
        var tweak = new SpyTweak("cpu.a");
        var harness = new Harness(tweak);
        harness.Runner.Result = new CommandResult(1, false);

        Assert.False(harness.Engine.ApplyTweaks(new[] { "cpu.a" }).Ok);

        Assert.Empty(tweak.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.checkpointFailed" && log.Type == "error");
    }

    [Fact]
    public void ApplyTweaks_CapturesEachTweaksPriorStateBeforeApplyingIt()
    {
        var harness = new Harness(new SpyTweak("cpu.a"), new SpyTweak("cpu.b"));

        harness.Engine.ApplyTweaks(new[] { "cpu.a", "cpu.b" });

        Assert.Equal(new[] { "cpu.a", "cpu.b" }, harness.Captures.Saved.Select(c => c.TweakId));
    }

    [Fact]
    public void ApplyTweaks_RejectsAnUnknownTweakWithoutApplyingAnythingElse()
    {
        var known = new SpyTweak("cpu.a");
        var harness = new Harness(known);

        Assert.False(harness.Engine.ApplyTweaks(new[] { "cpu.a", "cpu.ghost" }).Ok);

        Assert.Empty(known.Calls);
        Assert.Empty(harness.Captures.Saved);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.unknown");
    }

    [Fact]
    public void ApplyTweaks_RejectsAnEmptySelection()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));

        Assert.False(harness.Engine.ApplyTweaks(Array.Empty<string>()).Ok);
        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
    }

    [Fact]
    public void ApplyTweaks_ReportsFailureButKeepsGoingWhenOneTweakCannotBeApplied()
    {
        var failing = new SpyTweak("cpu.a", applies: false);
        var working = new SpyTweak("cpu.b");
        var harness = new Harness(failing, working);

        Assert.False(harness.Engine.ApplyTweaks(new[] { "cpu.a", "cpu.b" }).Ok);

        Assert.Contains("apply", working.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.applyFailed");
    }

    [Fact]
    public void ApplyTweaks_MeasuresTheSystemBeforeAndAfterAndPersistsBothSnapshots()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));

        TweakBatchResult result = harness.Engine.ApplyTweaks(new[] { "cpu.a" });

        Assert.NotNull(result.Diff);
        Assert.Equal(2, harness.History.Snapshots.Count);
        Assert.Same(harness.History.Snapshots[0], result.Diff!.Before);
        Assert.Same(harness.History.Snapshots[1], result.Diff.After);
    }

    [Fact]
    public void RevertTweak_RestoresFromTheCaptureTakenWhenItWasApplied()
    {
        var tweak = new SpyTweak("cpu.a");
        var harness = new Harness(tweak);
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });
        tweak.Calls.Clear();

        Assert.True(harness.Engine.RevertTweak("cpu.a"));

        Assert.Equal(new[] { "revert" }, tweak.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.reverted");
    }

    [Fact]
    public void RevertTweak_RefusesWhenTheTweakWasNeverAppliedThroughVeloSys()
    {
        var tweak = new SpyTweak("cpu.a");
        var harness = new Harness(tweak);

        Assert.False(harness.Engine.RevertTweak("cpu.a"));

        Assert.Empty(tweak.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.noCapture");
    }

    [Fact]
    public void RevertTweak_RejectsAnUnknownTweak()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));

        Assert.False(harness.Engine.RevertTweak("cpu.ghost"));
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.unknown");
    }

    [Fact]
    public void GetTweaksJson_ReportsEachTweaksLiveStateAndThePresetsOverThem()
    {
        var applied = new SpyTweak("cpu.a") { DetectedState = TweakState.Applied };
        var partial = new SpyTweak("cpu.b") { DetectedState = TweakState.Partial };
        var harness = new Harness(
            new Dictionary<string, IReadOnlyList<string>> { ["quick"] = new[] { "cpu.a" } },
            applied,
            partial
        );

        using JsonDocument document = JsonDocument.Parse(harness.Engine.GetTweaksJson());
        JsonElement root = document.RootElement;

        JsonElement[] tweaks = root.GetProperty("tweaks").EnumerateArray().ToArray();
        Assert.Equal(new[] { "cpu.a", "cpu.b" }, tweaks.Select(t => t.GetProperty("id").GetString()));
        Assert.Equal("Applied", tweaks[0].GetProperty("state").GetString());
        Assert.Equal("Partial", tweaks[1].GetProperty("state").GetString());
        Assert.Equal("Safe", tweaks[0].GetProperty("riskTier").GetString());
        Assert.Equal(TweakKinds.Registry, tweaks[0].GetProperty("kind").GetString());
        Assert.Equal(TweakCategories.Cpu, tweaks[0].GetProperty("category").GetString());

        JsonElement preset = Assert.Single(root.GetProperty("presets").EnumerateArray().ToArray());
        Assert.Equal("quick", preset.GetProperty("id").GetString());
        Assert.Equal(
            new[] { "cpu.a" },
            preset.GetProperty("tweakIds").EnumerateArray().Select(id => id.GetString())
        );
    }

    [Fact]
    public void LoadHistory_ReturnsEverySnapshotEverCaptured()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });

        Assert.Equal(2, harness.Engine.LoadHistory().Count);
    }
}
