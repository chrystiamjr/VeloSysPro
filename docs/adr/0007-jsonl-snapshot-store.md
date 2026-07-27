# Persist Snapshots as JSONL Behind a Storage Seam

Optimization Snapshots and the Optimization History will persist as **append-only JSONL** — one JSON object per line in `%LOCALAPPDATA%\VeloSysPro\history.jsonl` — behind an `ISnapshotStore` seam. Trends and history-by-date are computed in React over the loaded series. A database engine is deferred until a concrete trigger justifies it.

## Considered Options

- SQLite now, via `Microsoft.Data.Sqlite`.
- LiteDB now.
- Append-only JSONL behind an interface, swappable later.

## Consequences

The data is tiny — roughly one Snapshot per optimization run for a single-user desktop app — so a schema, migrations, and a native dependency would buy nothing today. Callers depend only on the interface, so swapping in a `SqliteSnapshotStore` stays isolated; the triggers that would justify it are ad-hoc time-range aggregation the UI cannot do cheaply in memory, external inspection with a database tool, or relational entities such as a per-Tweak audit trail joined to Snapshots. Reads must tolerate a corrupt or partial trailing line by skipping it, mirroring `SettingsManager`'s defensive parsing: a process killed mid-append must not cost the user their whole history. `AppPaths` remains the single canonical root for mutable data; operational logs stay as live console output and `.txt` files, outside the store.
