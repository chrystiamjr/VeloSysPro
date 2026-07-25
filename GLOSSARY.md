# VeloSys Pro Glossary

Canonical domain terminology and architectural concepts for the VeloSys Pro project.

## Terms

**IPC Bridge**:
The WebView2 IPC messaging interface between the React 18 TypeScript frontend (`window.chrome.webview.postMessage`) and the C# .NET 8 WPF desktop host handler (`desktop/MainWindow.xaml.cs`).
_Avoid_: Direct system call, raw socket

**Junction Links**:
NTFS Directory Junctions (`New-Item -Type Junction`) used to link central skills from `~/.agents/skills/` to target AI directories without requiring Administrator privileges on Windows.
_Avoid_: Hard copy, symlink shortcut

**Single Executable Deliverable**:
The unified release executable `VeloSysPro.exe` containing bundled frontend assets and WPF host binary.
_Avoid_: `.bat` launcher script, nested subfolder launch

**Atomic Design Hierarchy**:
Structuring React components into `atoms/`, `molecules/`, `organisms/`, `templates/`, and `pages/` using TypeScript interfaces.
_Avoid_: Monolithic components, runtime propTypes

**Deterministic Task Name**:
A Windows scheduled task identifier that encodes its whole schedule — `VeloSysPro_{Type}_{Frequency}[_{Day}]_{HHmm}`, e.g. `VeloSysPro_Gaming_Weekly_MON_0430`. Guarantees uniqueness so several schedules per optimization coexist, makes re-creation idempotent, and keeps the Windows Task Scheduler the single source of truth. Decoded client-side by `parseTaskName` in `src/domain/scheduling.ts`.
_Avoid_: Sidecar index, task registry file, `tasks.json` mapping

**Shared DataTable Organism**:
`src/components/organisms/DataTable.tsx` — the single sortable, paginated table used by every management screen (Scheduling, Backup, Restore Points). Callers supply declarative `DataTableColumn<T>` definitions; sorting, pagination, empty state, the horizontal-scroll wrapper and the stable `min-w` live in one place.
_Avoid_: Per-page table markup, copy-pasted `<thead>`/`<tbody>` blocks

**Inbound Payload Schema**:
A Zod schema in `src/domain/schemas.ts` describing one shape the C# host sends. The schemas are the single source of truth — the interfaces in `types.ts` are inferred from them with `z.infer` — and `bridge.ts` validates every inbound payload against one before handing it to the app.
_Avoid_: Casting `JSON.parse` output, `as ScheduledTaskItem[]`

**Screen Refresh Contract**:
The declared set of `GET_*` actions a screen re-requests when opened (`SCREEN_REFRESH_ACTIONS` in `App.tsx`), paired with an explicit refresh control on the table. Required because Windows can change scheduled tasks, restore points and backups without the app knowing.
_Avoid_: Mount-only fetching, polling loops, refetching inside `onActionFinished`

**Display Value Parser**:
A `src/domain/formatters.ts` helper (`parseDisplayDate`, `parseDisplayNumber`) that converts host-formatted display text back into a comparable primitive for sorting. Needed because the C# host emits culture-dependent strings (`dd/MM/yyyy HH:mm`, `ToString("N1")`).
_Avoid_: `parseFloat` on a formatted size, lexicographic date sort
