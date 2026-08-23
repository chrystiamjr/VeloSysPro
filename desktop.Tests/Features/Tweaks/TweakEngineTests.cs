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
        public bool RequiresReboot { get; set; }
        public TweakState DetectedState { get; set; } = TweakState.NotApplied;
        public List<string> Calls { get; } = new();

        public TweakState Detect() => DetectedState;

        /// <summary>What the Tweak reads back after being applied; drives the change report.</summary>
        public string CurrentData { get; set; } = "0x2";

        public IReadOnlyList<CapturedValue> ReadCurrentValues()
        {
            Calls.Add("read");
            return new[] { new CapturedValue("Value", "REG_DWORD", CurrentData, true) };
        }

        public TweakCapture Capture()
        {
            Calls.Add("capture");
            return new TweakCapture(Id, Kind, "2026-07-25T10:00:00.0000000Z",
                new[] { new CapturedValue("Value", "REG_DWORD", "0x2", true) });
        }

        public bool Apply(TweakCapture capture)
        {
            Calls.Add("apply");
            if (_applies) CurrentData = "0x26";
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
        public SafetyCheckpoint Checkpoint { get; }
        public TweakEngine Engine { get; }

        public Harness(params ITweak[] tweaks)
            : this(new Dictionary<string, IReadOnlyList<string>>(), tweaks) { }

        public Harness(IReadOnlyDictionary<string, IReadOnlyList<string>> presets, params ITweak[] tweaks)
        {
            // A machine with System Protection on is the baseline; tests that care about it off
            // override this entry.
            Runner.CapturedOutputsByArgs.Add(
                ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x1\r\n")
            );

            // ...and a checkpoint Windows really creates. SystemRestoreManager reads the restore
            // point back by name instead of trusting Checkpoint-Computer's exit code, so without
            // this the baseline machine would be one where every batch aborts.
            Runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "1"));

            Checkpoint = new SafetyCheckpoint(
                new SystemRestoreManager(Runner, Sink),
                // Unused by ExecuteTweakCheckpoint, which only touches System Restore; the path is
                // never written to because the fake command runner executes nothing.
                new RegistryBackupManager(
                    System.IO.Path.GetTempPath(),
                    Runner,
                    Sink,
                    System.IO.Path.GetTempPath()
                ),
                Sink
            );
            Engine = new TweakEngine(
                new TweakCatalog(tweaks, presets),
                Captures,
                new SystemRestoreManager(Runner, Sink),
                Checkpoint,
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
        Assert.Equal(new[] { "capture", "apply", "read" }, tweak.Calls);
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
    public void ApplyTweaks_StopsWithAnActionableMessageWhenSystemProtectionIsOff()
    {
        // The one failure the user can actually fix, so it must not arrive as a generic
        // restore-point error.
        var tweak = new SpyTweak("cpu.a");
        var harness = new Harness(tweak);
        harness.Runner.CapturedOutputsByArgs.Clear();
        harness.Runner.CapturedOutputsByArgs.Add(
            ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x0\r\n")
        );

        Assert.False(harness.Engine.ApplyTweaks(new[] { "cpu.a" }).Ok);

        Assert.Empty(tweak.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.protectionDisabled");
        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
    }

    [Fact]
    public void GetTweaksJson_TellsTheScreenWhetherTheSafetyNetIsAvailable()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Runner.CapturedOutputsByArgs.Clear();
        harness.Runner.CapturedOutputsByArgs.Add(
            ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x0\r\n")
        );

        using JsonDocument off = JsonDocument.Parse(harness.Engine.GetTweaksJson());
        Assert.False(off.RootElement.GetProperty("systemProtectionEnabled").GetBoolean());

        harness.Runner.CapturedOutputsByArgs.Clear();
        harness.Runner.CapturedOutputsByArgs.Add(
            ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x1\r\n")
        );
        using JsonDocument on = JsonDocument.Parse(harness.Engine.GetTweaksJson());
        Assert.True(on.RootElement.GetProperty("systemProtectionEnabled").GetBoolean());
    }

    [Fact]
    public void EnableSystemProtection_TurnsProtectionOnAndLiftsTheOncePerDayCap()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));

        Assert.True(harness.Engine.EnableSystemProtection());

        Assert.Contains(harness.Runner.Runs, run => run.Args.Contains("Enable-ComputerRestore"));
        Assert.Contains(
            harness.Runner.Runs,
            run => run.Args.Contains("SystemRestorePointCreationFrequency") && run.Args.Contains("/d 0")
        );
    }

    [Fact]
    public void EnableSystemProtection_ReportsFailureInsteadOfThrowingAtTheSeam()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Runner.Result = new CommandResult(1, false);

        Assert.False(harness.Engine.EnableSystemProtection());
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.protection.failed");
    }

    [Fact]
    public void ApplyTweaks_RespectsTheSafetyBackupPreference()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Checkpoint.Enabled = false;

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
    public void ApplyTweaks_ReportsWhatEachTweakActuallyChanged()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));

        TweakBatchResult result = harness.Engine.ApplyTweaks(new[] { "cpu.a" });

        TweakChange change = Assert.Single(result.Changes);
        Assert.Equal("cpu.a", change.TweakId);
        Assert.Equal("Value", change.Setting);
        Assert.Equal("0x2", change.Before);
        Assert.Equal("0x26", change.After);
    }

    [Fact]
    public void ApplyTweaks_ReportsNoChangeForAWriteThatSilentlyDidNothing()
    {
        // Reading the value back is what separates "applied" from "claimed to apply": a Tweak
        // whose write was a no-op must not show up as a change.
        var harness = new Harness(new SpyTweak("cpu.a", applies: false));

        Assert.Empty(harness.Engine.ApplyTweaks(new[] { "cpu.a" }).Changes);
    }

    [Fact]
    public void ApplyTweaks_ReportsNoChangesWhenTheBatchNeverRan()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Runner.Result = new CommandResult(1, false);

        Assert.Empty(harness.Engine.ApplyTweaks(new[] { "cpu.a" }).Changes);
    }

    [Fact]
    public void ApplyTweaks_UndoesAndAppliesUnderOneCheckpoint()
    {
        // The screen submits a desired state, so one intention can both undo and do. Splitting it
        // would mean two restore points around halves of a single change.
        var toRevert = new SpyTweak("cpu.a");
        var toApply = new SpyTweak("cpu.b");
        var harness = new Harness(toRevert, toApply);
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });
        toRevert.Calls.Clear();
        int checkpointsBefore = harness.Runner.Runs.Count(run => run.Args.Contains("Checkpoint-Computer"));

        Assert.True(harness.Engine.ApplyTweaks(new[] { "cpu.b" }, new[] { "cpu.a" }).Ok);

        Assert.Contains("revert", toRevert.Calls);
        Assert.Contains("apply", toApply.Calls);
        Assert.Equal(
            checkpointsBefore + 1,
            harness.Runner.Runs.Count(run => run.Args.Contains("Checkpoint-Computer"))
        );
    }

    [Fact]
    public void ApplyTweaks_UndoesBeforeApplyingSoTheBatchEndsInTheDrawnState()
    {
        var reverted = new SpyTweak("cpu.a");
        var applied = new SpyTweak("cpu.b");
        var harness = new Harness(reverted, applied);
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });
        reverted.Calls.Clear();
        applied.Calls.Clear();
        var order = new List<string>();
        harness.Sink.Logs.Clear();

        harness.Engine.ApplyTweaks(new[] { "cpu.b" }, new[] { "cpu.a" });

        foreach ((string Key, string Type, object? Args) log in harness.Sink.Logs)
        {
            if (log.Key == "log.tweaks.reverted") order.Add("revert");
            if (log.Key == "log.tweaks.applied") order.Add("apply");
        }
        Assert.Equal(new[] { "revert", "apply" }, order);
    }

    [Fact]
    public void ApplyTweaks_ReportsBothDirectionsInTheChangeList()
    {
        var toRevert = new SpyTweak("cpu.a");
        var toApply = new SpyTweak("cpu.b");
        var harness = new Harness(toRevert, toApply);
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });

        TweakBatchResult result = harness.Engine.ApplyTweaks(new[] { "cpu.b" }, new[] { "cpu.a" });

        Assert.Contains(result.Changes, change => change.TweakId == "cpu.b");
    }

    [Fact]
    public void ApplyTweaks_FailsTheBatchButKeepsGoingWhenATweakHasNoCaptureToUndo()
    {
        var neverApplied = new SpyTweak("cpu.a");
        var toApply = new SpyTweak("cpu.b");
        var harness = new Harness(neverApplied, toApply);

        Assert.False(harness.Engine.ApplyTweaks(new[] { "cpu.b" }, new[] { "cpu.a" }).Ok);

        Assert.DoesNotContain("revert", neverApplied.Calls);
        Assert.Contains("apply", toApply.Calls);
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.noCapture");
    }

    [Fact]
    public void ApplyTweaks_RejectsAnUnknownIdOnEitherSideOfTheBatch()
    {
        var known = new SpyTweak("cpu.a");
        var harness = new Harness(known);

        Assert.False(harness.Engine.ApplyTweaks(Array.Empty<string>(), new[] { "cpu.ghost" }).Ok);

        Assert.Empty(known.Calls);
        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
    }

    [Fact]
    public void ApplyTweaks_AcceptsABatchThatOnlyUndoes()
    {
        var tweak = new SpyTweak("cpu.a");
        var harness = new Harness(tweak);
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });
        tweak.Calls.Clear();

        Assert.True(harness.Engine.ApplyTweaks(Array.Empty<string>(), new[] { "cpu.a" }).Ok);

        Assert.Contains("revert", tweak.Calls);
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
    public void GetTweaksJson_CarriesTheRebootFlagPerTweak()
    {
        // The screen badges the row from this field. Derived from translated copy instead, the
        // badge would go missing in whichever language nobody thought to check.
        var immediate = new SpyTweak("cpu.a");
        var afterRestart = new SpyTweak("boot.b") { RequiresReboot = true };
        var harness = new Harness(immediate, afterRestart);

        using JsonDocument document = JsonDocument.Parse(harness.Engine.GetTweaksJson());
        JsonElement[] tweaks = document
            .RootElement.GetProperty("tweaks")
            .EnumerateArray()
            .ToArray();

        Assert.False(tweaks[0].GetProperty("requiresReboot").GetBoolean());
        Assert.True(tweaks[1].GetProperty("requiresReboot").GetBoolean());
    }

    [Fact]
    public void ApplyPreset_RunsEveryTweakThePresetNames()
    {
        // The headless CLI's entry point. It applies the whole selection rather than a difference,
        // because a scheduled run has nobody drawing an intent on the screen.
        var inPreset = new SpyTweak("cpu.a");
        var outside = new SpyTweak("cpu.b");
        var harness = new Harness(
            new Dictionary<string, IReadOnlyList<string>> { ["gaming"] = new[] { "cpu.a" } },
            inPreset,
            outside
        );

        Assert.True(harness.Engine.ApplyPreset("gaming"));

        Assert.Contains("apply", inPreset.Calls);
        Assert.DoesNotContain("apply", outside.Calls);
    }

    [Fact]
    public void HasPreset_SeparatesAnUnknownTaskNameFromAFailedRun()
    {
        // App.RunHeadless branches on this: folding "no such preset" into ApplyPreset's bool made a
        // gaming batch that ran and failed report itself as an unknown task name.
        var failing = new SpyTweak("cpu.a", applies: false);
        var harness = new Harness(
            new Dictionary<string, IReadOnlyList<string>> { ["gaming"] = new[] { "cpu.a" } },
            failing
        );

        Assert.True(harness.Engine.HasPreset("gaming"));
        Assert.False(harness.Engine.ApplyPreset("gaming"));

        Assert.False(harness.Engine.HasPreset("quick"));
        Assert.False(harness.Engine.ApplyPreset("quick"));
        Assert.Contains(harness.Sink.Logs, log => log.Key == "log.tweaks.unknownPreset");
    }

    [Fact]
    public void Measure_DoesNotAppendToTheHistory()
    {
        // The Optimization History is the record of what batches did. A standalone measurement is
        // not a batch, and persisting one wedges an unrelated row between a batch's before and its
        // after — which is exactly what the panel reads as "the last comparison".
        var harness = new Harness(new SpyTweak("cpu.a"));

        harness.Engine.Measure();

        Assert.Empty(harness.History.Snapshots);
    }

    [Fact]
    public void Measure_StillReturnsTheReading()
    {
        // Not persisting it must not mean not taking it: the caller needs the current boot's
        // identity and duration to resolve a reboot-dependent comparison.
        var harness = new Harness(new SpyTweak("cpu.a"));

        Assert.NotNull(harness.Engine.Measure());
    }

    [Fact]
    public void ApplyTweaks_LeavesOnlyItsOwnPairInTheHistory()
    {
        // The pair has to stay adjacent and alone, whatever else the app measured around it.
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Engine.Measure();

        harness.Engine.ApplyTweaks(new[] { "cpu.a" });

        harness.Engine.Measure();

        Assert.Equal(2, harness.History.Snapshots.Count);
    }

    [Fact]
    public void LoadHistory_ReturnsEverySnapshotEverCaptured()
    {
        var harness = new Harness(new SpyTweak("cpu.a"));
        harness.Engine.ApplyTweaks(new[] { "cpu.a" });

        Assert.Equal(2, harness.Engine.LoadHistory().Count);
    }
}
