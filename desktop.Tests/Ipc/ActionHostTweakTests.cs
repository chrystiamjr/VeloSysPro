using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// Covers the Tweak half of the Action seam: payload validation, mutation exclusion, and the
/// refresh/completion Events every Action ends with.
/// </summary>
public class ActionHostTweakTests
{
    private sealed class Harness : IDisposable
    {
        private readonly TemporaryDirectory _temp = new();

        public FakeCommandRunner Runner { get; } = new();
        public RecordingStatusSink Sink { get; } = new();
        public List<(string Event, JsonElement Payload)> Events { get; } = new();
        public ActionHost Host { get; }

        public Harness()
        {
            // Every batch now checks System Protection first; a machine with it on is the baseline.
            Runner.CapturedOutputsByArgs.Add(
                ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x1\r\n")
            );

            // ...and one where the Safety Checkpoint really lands. SystemRestoreManager reads the
            // restore point back by name rather than trusting Checkpoint-Computer's exit code.
            Runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "1"));

            // A readable start type for services.sysMain, the Tweak these tests dispatch. Without
            // it the capture records "unknown", which ServiceTweak.Apply now refuses rather than
            // reconfiguring a service it could not read and could not put back.
            Runner.CapturedOutputsByArgs.Add(("Get-Service", "Automatic\r\n"));

            var emitter = new IpcEventEmitter(json =>
            {
                using JsonDocument document = JsonDocument.Parse(json);
                var entry = (
                    document.RootElement.GetProperty("event").GetString()!,
                    document.RootElement.GetProperty("payload").Clone()
                );
                // ActionHost runs each Action on the thread pool, so the recorder is shared state.
                lock (Events) Events.Add(entry);
            });

            var backup = new RegistryBackupManager(_temp.Path, Runner, Sink, _temp.Path);
            var engine = new TweakEngine(
                TweakCatalog.CreateDefault(Runner, backup),
                new JsonTweakCaptureStore(_temp.Path),
                new SystemRestoreManager(Runner, Sink),
                new SnapshotManager(Runner, Sink),
                new JsonlSnapshotStore(System.IO.Path.Combine(_temp.Path, "history.jsonl")),
                Sink
            );

            Host = new ActionHost(
                new Optimizer(Runner, backup, Sink),
                backup,
                new SystemRestoreManager(Runner, Sink),
                new SchedulerManager(Runner, Sink, "VeloSysPro.exe"),
                new SettingsManager(System.IO.Path.Combine(_temp.Path, "settings.json")),
                engine,
                emitter,
                Sink,
                _temp.Path,
                _temp.Path
            );
        }

        /// <summary>
        /// Dispatches an Action and waits for a *new* authoritative actionFinished Event. Waiting
        /// on the delta rather than on "any actionFinished for this name" is what makes dispatching
        /// the same Action twice in one test observe two completions instead of the first one twice.
        /// </summary>
        public bool Dispatch(string action, string payloadJson = "null")
        {
            int before = CompletionsOf(action).Count;

            using JsonDocument payload = JsonDocument.Parse(payloadJson);
            Host.Handle(new IpcHandler.IpcMessage(action, payload.RootElement.Clone()));

            for (int attempt = 0; attempt < 500; attempt++)
            {
                List<JsonElement> completions = CompletionsOf(action);
                if (completions.Count > before)
                    return completions[^1].GetProperty("ok").GetBoolean();
                Thread.Sleep(10);
            }

            throw new TimeoutException("actionFinished never arrived for " + action);
        }

        private List<JsonElement> CompletionsOf(string action)
        {
            lock (Events)
            {
                return Events
                    .Where(entry =>
                        entry.Event == IpcEvents.ActionFinished
                        && entry.Payload.GetProperty("action").GetString() == action
                    )
                    .Select(entry => entry.Payload)
                    .ToList();
            }
        }

        public IEnumerable<JsonElement> PayloadsOf(string eventName)
        {
            lock (Events)
            {
                return Events
                    .Where(entry => entry.Event == eventName)
                    .Select(entry => entry.Payload)
                    .ToList();
            }
        }

        public void Dispose() => _temp.Dispose();
    }

    [Fact]
    public void LoadTweaks_EmitsTheCatalogWithEveryTweaksLiveState()
    {
        using var harness = new Harness();

        Assert.True(harness.Dispatch(SystemActions.LoadTweaks));

        JsonElement payload = Assert.Single(harness.PayloadsOf(IpcEvents.TweaksLoaded));
        string[] ids = payload
            .GetProperty("tweaks")
            .EnumerateArray()
            .Select(tweak => tweak.GetProperty("id").GetString()!)
            .ToArray();
        Assert.Contains("cpu.win32PrioritySeparation", ids);
        Assert.Contains("boot.disableDynamicTick", ids);
        Assert.Contains("services.sysMain", ids);
        Assert.NotEmpty(payload.GetProperty("presets").EnumerateArray());
    }

    [Fact]
    public void ApplyTweaks_RefreshesTheCatalogAndPublishesTheBeforeAfterSnapshot()
    {
        using var harness = new Harness();

        Assert.True(
            harness.Dispatch(SystemActions.ApplyTweaks, """{"tweakIds":["services.sysMain"]}""")
        );

        Assert.Single(harness.PayloadsOf(IpcEvents.TweaksLoaded));
        JsonElement snapshot = Assert.Single(harness.PayloadsOf(IpcEvents.SnapshotCaptured));
        Assert.NotEqual(JsonValueKind.Null, snapshot.GetProperty("before").ValueKind);
        Assert.NotEqual(JsonValueKind.Null, snapshot.GetProperty("after").ValueKind);
        Assert.NotEqual(
            "",
            snapshot.GetProperty("after").GetProperty("capturedAt").GetString()
        );
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("""{"tweakIds":[]}""")]
    [InlineData("\"services.sysMain\"")]
    public void ApplyTweaks_RejectsAMalformedPayloadWithoutTouchingTheSystem(string payload)
    {
        using var harness = new Harness();

        Assert.False(harness.Dispatch(SystemActions.ApplyTweaks, payload));

        Assert.Empty(harness.PayloadsOf(IpcEvents.TweaksLoaded));
        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
        // Rejected *at the seam*: the engine's own empty-selection log proves it was entered, so
        // its absence is what distinguishes "validated here" from "validated downstream".
        Assert.DoesNotContain(harness.Sink.Logs, log => log.Key == "log.tweaks.noneSelected");
    }

    [Fact]
    public void ApplyTweaks_AcceptsABatchThatOnlyUndoes()
    {
        // The screen submits a desired state, so "revert everything" arrives as an applyTweaks
        // with an empty apply list — which must not be mistaken for an empty payload.
        using var harness = new Harness();
        harness.Runner.CapturedOutput = "Automatic\r\n";
        harness.Dispatch(SystemActions.ApplyTweaks, """{"tweakIds":["services.sysMain"]}""");

        Assert.True(
            harness.Dispatch(
                SystemActions.ApplyTweaks,
                """{"tweakIds":[],"revertIds":["services.sysMain"]}"""
            )
        );

        Assert.Contains(harness.Runner.Runs, run => run.Args == "config SysMain start= auto");
    }

    [Fact]
    public void ApplyTweaks_RejectsAnUnknownTweakId()
    {
        using var harness = new Harness();

        Assert.False(harness.Dispatch(SystemActions.ApplyTweaks, """{"tweakIds":["cpu.ghost"]}"""));

        Assert.Empty(harness.PayloadsOf(IpcEvents.TweaksLoaded));
    }

    [Fact]
    public void RevertTweak_DoesNotRefreshTheCatalogWhenThereIsNoCaptureToRestore()
    {
        using var harness = new Harness();

        Assert.False(harness.Dispatch(SystemActions.RevertTweak, "\"services.sysMain\""));

        Assert.Empty(harness.PayloadsOf(IpcEvents.TweaksLoaded));
    }

    [Fact]
    public void RevertTweak_RestoresTheCapturedStartTypeAndRefreshesTheCatalog()
    {
        using var harness = new Harness();
        harness.Runner.CapturedOutput = "Automatic\r\n";
        harness.Dispatch(SystemActions.ApplyTweaks, """{"tweakIds":["services.sysMain"]}""");

        Assert.True(harness.Dispatch(SystemActions.RevertTweak, "\"services.sysMain\""));

        Assert.Contains(harness.Runner.Runs, run => run.Args == "config SysMain start= auto");
        Assert.Equal(2, harness.PayloadsOf(IpcEvents.TweaksLoaded).Count());
    }

    [Fact]
    public void CaptureSnapshot_PublishesAMeasurementWithNoBaselineToCompareAgainst()
    {
        using var harness = new Harness();

        Assert.True(harness.Dispatch(SystemActions.CaptureSnapshot));

        JsonElement payload = Assert.Single(harness.PayloadsOf(IpcEvents.SnapshotCaptured));
        Assert.Equal(JsonValueKind.Null, payload.GetProperty("before").ValueKind);
        Assert.NotEqual(JsonValueKind.Null, payload.GetProperty("after").ValueKind);
    }

    [Fact]
    public void LoadHistory_EmitsThePersistedSeriesOldestFirst()
    {
        using var harness = new Harness();
        harness.Dispatch(SystemActions.CaptureSnapshot);
        harness.Dispatch(SystemActions.CaptureSnapshot);

        Assert.True(harness.Dispatch(SystemActions.LoadHistory));

        JsonElement payload = harness.PayloadsOf(IpcEvents.HistoryLoaded).Last();
        JsonElement[] entries = payload.EnumerateArray().ToArray();
        Assert.Equal(2, entries.Length);
        Assert.True(
            string.CompareOrdinal(
                entries[0].GetProperty("capturedAt").GetString(),
                entries[1].GetProperty("capturedAt").GetString()
            ) <= 0
        );
    }

    [Fact]
    public void LoadTweaks_IsAReadAndNeverBlocksOnTheMutationLock()
    {
        using var harness = new Harness();

        // Reads stay concurrent: dispatching two in a row must not reject either of them.
        Assert.True(harness.Dispatch(SystemActions.LoadTweaks));
        Assert.True(harness.Dispatch(SystemActions.LoadHistory));
    }
}
