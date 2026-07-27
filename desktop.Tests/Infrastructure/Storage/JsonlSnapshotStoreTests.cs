using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;

namespace VeloSysPro.Tests;

public class JsonlSnapshotStoreTests
{
    private static OptimizationSnapshot Snapshot(string capturedAt, long freeMemory = 8_000_000_000) =>
        new(
            CapturedAt: capturedAt,
            BootDurationMs: 21_000,
            FreeMemoryBytes: freeMemory,
            TotalMemoryBytes: 16_000_000_000,
            FreeDiskBytes: 120_000_000_000,
            TotalDiskBytes: 500_000_000_000,
            AutomaticServices: 90,
            RunningServices: 70,
            StartupApps: 12,
            PendingReboot: false
        );

    [Fact]
    public void ReadAll_ReturnsAppendedSnapshotsInInsertionOrder()
    {
        using var temp = new TemporaryDirectory();
        string file = Path.Combine(temp.Path, "history.jsonl");
        var store = new JsonlSnapshotStore(file);

        store.Append(Snapshot("2026-07-25T10:00:00.0000000Z", 8_000_000_000));
        store.Append(Snapshot("2026-07-25T10:05:00.0000000Z", 9_000_000_000));
        store.Append(Snapshot("2026-07-26T09:00:00.0000000Z", 7_000_000_000));

        IReadOnlyList<OptimizationSnapshot> all = new JsonlSnapshotStore(file).ReadAll();

        Assert.Equal(
            new[]
            {
                "2026-07-25T10:00:00.0000000Z",
                "2026-07-25T10:05:00.0000000Z",
                "2026-07-26T09:00:00.0000000Z",
            },
            all.Select(snapshot => snapshot.CapturedAt)
        );
        Assert.Equal(new long[] { 8_000_000_000, 9_000_000_000, 7_000_000_000 },
            all.Select(snapshot => snapshot.FreeMemoryBytes));
    }

    [Fact]
    public void Append_PersistsOneCamelCaseJsonObjectPerLine()
    {
        using var temp = new TemporaryDirectory();
        string file = Path.Combine(temp.Path, "history.jsonl");
        var store = new JsonlSnapshotStore(file);

        store.Append(Snapshot("2026-07-25T10:00:00.0000000Z"));
        store.Append(Snapshot("2026-07-25T10:05:00.0000000Z"));

        string[] lines = File.ReadAllLines(file);
        Assert.Equal(2, lines.Length);
        Assert.All(lines, line => Assert.DoesNotContain("\"CapturedAt\"", line));
        Assert.All(lines, line => Assert.Contains("\"capturedAt\"", line));
        Assert.All(lines, line => Assert.Contains("\"freeMemoryBytes\"", line));
    }

    [Fact]
    public void ReadAll_SkipsACorruptTrailingLineAndKeepsEarlierEntries()
    {
        using var temp = new TemporaryDirectory();
        string file = Path.Combine(temp.Path, "history.jsonl");
        var store = new JsonlSnapshotStore(file);
        store.Append(Snapshot("2026-07-25T10:00:00.0000000Z"));
        store.Append(Snapshot("2026-07-25T10:05:00.0000000Z"));

        // A crash mid-write leaves a half-serialized object behind.
        File.AppendAllText(file, "{\"capturedAt\":\"2026-07-25T10:10:00\",\"freeMe");

        IReadOnlyList<OptimizationSnapshot> all = new JsonlSnapshotStore(file).ReadAll();

        Assert.Equal(2, all.Count);
        Assert.Equal("2026-07-25T10:05:00.0000000Z", all[^1].CapturedAt);
    }

    [Fact]
    public void ReadAll_SkipsACorruptLineInTheMiddleWithoutLosingLaterEntries()
    {
        using var temp = new TemporaryDirectory();
        string file = Path.Combine(temp.Path, "history.jsonl");
        File.WriteAllLines(
            file,
            new[]
            {
                "{\"capturedAt\":\"2026-07-25T10:00:00.0000000Z\",\"freeMemoryBytes\":1}",
                "not json at all",
                "",
                "{\"capturedAt\":\"2026-07-25T10:05:00.0000000Z\",\"freeMemoryBytes\":2}",
            }
        );

        IReadOnlyList<OptimizationSnapshot> all = new JsonlSnapshotStore(file).ReadAll();

        Assert.Equal(
            new[] { "2026-07-25T10:00:00.0000000Z", "2026-07-25T10:05:00.0000000Z" },
            all.Select(snapshot => snapshot.CapturedAt)
        );
    }

    [Fact]
    public void Append_SurvivesConcurrentWritersWithoutLosingOrTearingALine()
    {
        // captureSnapshot is a read Action, so the host's mutation lock does not serialize it
        // against the before/after pair a batch appends: two threads really can land at once.
        using var temp = new TemporaryDirectory();
        string file = Path.Combine(temp.Path, "history.jsonl");
        var store = new JsonlSnapshotStore(file);

        System.Threading.Tasks.Parallel.For(
            0,
            60,
            index => store.Append(Snapshot("2026-07-25T10:00:00.0000000Z", 1_000_000 + index))
        );

        IReadOnlyList<OptimizationSnapshot> all = new JsonlSnapshotStore(file).ReadAll();
        Assert.Equal(60, all.Count);
        Assert.Equal(60, File.ReadAllLines(file).Length);
    }

    [Fact]
    public void ReadAll_ReturnsEmptyWhenTheHistoryFileDoesNotExistYet()
    {
        using var temp = new TemporaryDirectory();
        var store = new JsonlSnapshotStore(Path.Combine(temp.Path, "nested", "history.jsonl"));

        Assert.Empty(store.ReadAll());
    }

    [Fact]
    public void HistoryFile_LivesUnderTheCanonicalApplicationDataRoot()
    {
        Assert.Equal(Path.Combine(AppPaths.Root, "history.jsonl"), AppPaths.HistoryFile);
    }
}
