# Deterministic Naming Over a Sidecar Index

When VeloSys Pro needs to correlate N records with OS-managed objects, encode the correlating data
in the object's own identifier rather than persisting a sidecar index (SQLite table or JSON file).
The OS registry stays the single source of truth, so there is nothing to drift, nothing to migrate,
and no new native dependency. This shapes any future "where do we store this mapping?" decision.

## Details & Context

**The problem.** Scheduled task names were derived from the optimization type alone
(`VeloSysPro_Quick`), so scheduling *Quick/Daily* and then *Quick/Weekly* silently overwrote the
first via `schtasks /f`. Supporting N distinct schedules required a way to tell them apart.

**The proposal that was declined.** A `tasks.json` (or SQLite table) mapping a short id to
`{type, frequency, time, day}`, with tasks named `VeloSysPro_<id>`.

**What was chosen instead.** The name carries the whole schedule:

```
VeloSysPro_Quick_Daily_0300
VeloSysPro_Quick_Daily_0500          <- coexist; no longer overwrite
VeloSysPro_Gaming_Weekly_MON_0430
VeloSysPro_Full_Monthly_15_0200
```

**Why this won:**

- **Zero drift.** A sidecar is a second source of truth. Deleting a task in `taskschd.msc`, or
  reinstalling, leaves an orphan entry. With the name carrying everything, the list is always exactly
  what Windows reports — verified by a test asserting a just-created task is absent once the query
  stops reporting it.
- **Idempotency for free.** Deterministic names mean re-creating an identical schedule overwrites
  itself via `/f` instead of producing a duplicate.
- **No new dependency.** SQLite would ship `e_sqlite3.dll` alongside the binary, which conflicts
  with the **Single Executable Deliverable** guardrail in `AGENTS.md`.
- **No extra round-trip.** The frontend decodes the name locally (`frontend/src/domain/scheduling.ts`,
  `parseTaskName`), so the host does not have to enrich the payload with trigger details, avoiding
  the `DaysOfWeek` / `DaysOfMonth` bitmask arithmetic that reading triggers back would require.

**Cost accepted.** The user-facing table must decode the name instead of reading a field, and old
names (`VeloSysPro_Quick`, two segments) need a compatibility path — they stay listed and removable
with `—` in the cadence column.

**Generalizes to:** restore points (already keyed by `Sequence`) and registry backups (already keyed
by the timestamp in the filename). Both already follow this shape; the scheduler was the outlier.

## Related

- [locale-neutral-boundary-data.md](../rules/locale-neutral-boundary-data.md) — the listing swap this
  enabled, and why `Get-ScheduledTask` replaced `schtasks /query`.
- Sessions: PRs #23, #24, #25.
