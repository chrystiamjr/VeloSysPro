using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using Xunit;

namespace VeloSysPro.Tests;

/// <summary>
/// Covers the Debloat half of the Action seam: payload validation, routing, the per-package
/// results Event, and the refresh that only a batch which really ran is allowed to trigger.
/// </summary>
public class ActionHostDebloatTests
{
    private sealed class Harness : IDisposable
    {
        private readonly TemporaryDirectory _temp = new();

        public FakeCommandRunner Runner { get; } = new();
        public RecordingStatusSink Sink { get; } = new();
        public List<(string Event, JsonElement Payload)> Events { get; } = new();
        public ActionHost Host { get; }

        public Harness(string installedJson = "[\"Microsoft.BingWeather\"]")
        {
            Runner.CapturedOutputsByArgs.Add(
                ("RPSessionInterval", "    RPSessionInterval    REG_DWORD    0x1\r\n")
            );
            Runner.CapturedOutputsByArgs.Add(("ExpandProperty Count", "1"));
            Runner.CapturedOutputsByArgs.Add(("Get-AppxPackage |", installedJson));

            var emitter = new IpcEventEmitter(json =>
            {
                using JsonDocument document = JsonDocument.Parse(json);
                var entry = (
                    document.RootElement.GetProperty("event").GetString()!,
                    document.RootElement.GetProperty("payload").Clone()
                );
                lock (Events) Events.Add(entry);
            });

            var backup = new RegistryBackupManager(_temp.Path, Runner, Sink, _temp.Path);
            var checkpoint = new SafetyCheckpoint(new SystemRestoreManager(Runner, Sink), Sink);

            Host = new ActionHost(
                new Optimizer(Runner, backup, Sink),
                backup,
                new SystemRestoreManager(Runner, Sink),
                new SchedulerManager(Runner, Sink, "VeloSysPro.exe"),
                new SettingsManager(System.IO.Path.Combine(_temp.Path, "settings.json")),
                new TweakEngine(
                    TweakCatalog.CreateDefault(Runner, backup),
                    new JsonTweakCaptureStore(_temp.Path),
                    new SystemRestoreManager(Runner, Sink),
                    checkpoint,
                    new SnapshotManager(Runner, Sink),
                    new JsonlSnapshotStore(System.IO.Path.Combine(_temp.Path, "history.jsonl")),
                    Sink
                ),
                new DebloatManager(DebloatCatalog.CreateDefault(), Runner, checkpoint, Sink),
                checkpoint,
                emitter,
                Sink,
                _temp.Path,
                _temp.Path
            );
        }

        public bool Dispatch(string action, string payloadJson = "null")
        {
            int before = CompletionsOf(action).Count;

            using JsonDocument payload = JsonDocument.Parse(payloadJson);
            Host.Handle(new IpcHandler.IpcMessage(action, payload.RootElement.Clone()));

            for (int attempt = 0; attempt < 500; attempt++)
            {
                List<JsonElement> completions = CompletionsOf(action);
                if (completions.Count > before) return completions[^1].GetProperty("ok").GetBoolean();
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

        public List<JsonElement> PayloadsOf(string eventName)
        {
            lock (Events)
            {
                return Events
                    .Where(entry => entry.Event == eventName)
                    .Select(entry => entry.Payload)
                    .ToList();
            }
        }

        public List<(string Exe, string Args)> RemovalCommands =>
            Runner
                .Runs.Where(run =>
                    run.Args.Contains("Remove-AppxPackage", StringComparison.OrdinalIgnoreCase)
                    || run.Args.Contains("/uninstall", StringComparison.OrdinalIgnoreCase)
                )
                .ToList();

        public void Dispose() => _temp.Dispose();
    }

    [Fact]
    public void LoadDebloat_EmitsTheAllowListWithEveryEntrysLiveState()
    {
        using var harness = new Harness();

        Assert.True(harness.Dispatch(SystemActions.LoadDebloat));

        JsonElement payload = Assert.Single(harness.PayloadsOf(IpcEvents.DebloatLoaded));
        List<JsonElement> packages = payload.GetProperty("packages").EnumerateArray().ToList();

        Assert.Equal(DebloatCatalog.CreateDefault().Entries.Count, packages.Count);
        Assert.True(
            packages
                .Single(entry => entry.GetProperty("id").GetString() == "weather")
                .GetProperty("installed")
                .GetBoolean()
        );
    }

    [Fact]
    public void LoadDebloat_IsAReadAndNeverTouchesTheSystem()
    {
        using var harness = new Harness();

        harness.Dispatch(SystemActions.LoadDebloat);

        Assert.Empty(harness.RemovalCommands);
        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
    }

    [Fact]
    public void RunDebloat_ReportsEachPackageAndRefreshesTheList()
    {
        using var harness = new Harness();
        // The read-back after the removal finds an empty machine, so the entry really went.
        harness.Runner.CapturedOutputsByArgs.Insert(0, ("Get-AppxPackage |", "[]"));

        Assert.True(harness.Dispatch(SystemActions.RunDebloat, """{"packageIds":["weather"]}"""));

        JsonElement completed = Assert.Single(harness.PayloadsOf(IpcEvents.DebloatCompleted));
        JsonElement result = Assert.Single(completed.GetProperty("results").EnumerateArray());
        Assert.Equal("weather", result.GetProperty("id").GetString());
        Assert.True(result.GetProperty("ok").GetBoolean());

        Assert.Single(harness.PayloadsOf(IpcEvents.DebloatLoaded));
    }

    [Fact]
    public void RunDebloat_ReportsAPartialBatchTruthfully()
    {
        using var harness = new Harness("[\"Microsoft.BingWeather\",\"Microsoft.BingNews\"]");
        harness.Runner.CapturedOutputsByArgs.Insert(
            0,
            ("Get-AppxPackage |", "[\"Microsoft.BingWeather\"]")
        );

        Assert.False(
            harness.Dispatch(SystemActions.RunDebloat, """{"packageIds":["weather","news"]}""")
        );

        JsonElement completed = Assert.Single(harness.PayloadsOf(IpcEvents.DebloatCompleted));
        List<JsonElement> results = completed.GetProperty("results").EnumerateArray().ToList();
        Assert.Equal(2, results.Count);
        Assert.False(results.Single(r => r.GetProperty("id").GetString() == "weather").GetProperty("ok").GetBoolean());
        Assert.True(results.Single(r => r.GetProperty("id").GetString() == "news").GetProperty("ok").GetBoolean());
        // A failed entry does not cancel the refresh: the list must show what really happened.
        Assert.Single(harness.PayloadsOf(IpcEvents.DebloatLoaded));
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("""{"packageIds":[]}""")]
    [InlineData("\"weather\"")]
    public void RunDebloat_RejectsAMalformedPayloadAtTheSeam(string payload)
    {
        using var harness = new Harness();

        Assert.False(harness.Dispatch(SystemActions.RunDebloat, payload));

        Assert.Empty(harness.RemovalCommands);
        Assert.Empty(harness.PayloadsOf(IpcEvents.DebloatCompleted));
        Assert.Empty(harness.PayloadsOf(IpcEvents.DebloatLoaded));
        // Rejected here rather than downstream: the manager's own empty-selection log would prove
        // it had been entered.
        Assert.DoesNotContain(harness.Sink.Logs, log => log.Key == "log.debloat.noneSelected");
    }

    [Fact]
    public void RunDebloat_RefusesAnIdOutsideTheAllowListWithoutRefreshingAnything()
    {
        using var harness = new Harness();

        Assert.False(
            harness.Dispatch(
                SystemActions.RunDebloat,
                """{"packageIds":["Microsoft.BingWeather"]}"""
            )
        );

        Assert.Empty(harness.RemovalCommands);
        Assert.DoesNotContain(harness.Runner.Runs, run => run.Args.Contains("Checkpoint-Computer"));
        // Nothing ran, so nothing may be re-read: a refresh here would make a refused batch look
        // like one that happened to change nothing.
        Assert.Empty(harness.PayloadsOf(IpcEvents.DebloatLoaded));
        Assert.Empty(harness.PayloadsOf(IpcEvents.DebloatCompleted));
    }

    [Fact]
    public void RunDebloat_HoldsTheMutationLockForItsWholeRun()
    {
        // Serialised with every other mutation rather than only with itself: a removal running
        // beside a Tweak batch would share one restore point between two different intentions.
        using var harness = new Harness();
        harness.Runner.HoldCommandsContaining = "Remove-AppxPackage";

        var removal = new Thread(() =>
            harness.Host.Handle(
                new IpcHandler.IpcMessage(
                    SystemActions.RunDebloat,
                    JsonDocument.Parse("""{"packageIds":["weather"]}""").RootElement.Clone()
                )
            )
        );
        removal.Start();

        Assert.True(
            harness.Runner.HeldCommandReached.Wait(TimeSpan.FromSeconds(5)),
            "the removal never started"
        );

        Assert.False(harness.Dispatch(SystemActions.CreateRestorePoint));
        Assert.Contains(
            harness.Sink.RawLogs,
            log => log.Text.Contains("rejected while another mutation is active")
        );

        harness.Runner.ReleaseHeldCommand();
        removal.Join(TimeSpan.FromSeconds(5));
    }
}
