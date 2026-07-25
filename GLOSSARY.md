# VeloSys Pro Glossary

Canonical domain terminology and architectural concepts for the VeloSys Pro project.

## Terms

**IPC Bridge**:
The WebView2 IPC messaging interface between the React 18 TypeScript frontend and the C# .NET 8 WPF desktop host. React sends Actions with `window.chrome.webview.postMessage`; the host emits structured Events through the WebView2 `message` channel.
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
A Windows scheduled task identifier that encodes its whole schedule — `VeloSysPro_{Type}_{Frequency}[_{Day}]_{HHmm}`, e.g. `VeloSysPro_Gaming_Weekly_MON_0430`. Guarantees uniqueness so several schedules per optimization coexist, makes re-creation idempotent, and keeps the Windows Task Scheduler the single source of truth. The host decodes it into structured schedule fields before crossing the IPC Bridge seam.
_Avoid_: Sidecar index, task registry file, `tasks.json` mapping

**Shared DataTable Organism**:
`frontend/src/components/organisms/DataTable.tsx` — the single sortable, paginated table used by every management screen (Scheduling, Backup, Restore Points). Callers supply declarative `DataTableColumn<T>` definitions; sorting, pagination, empty state, the horizontal-scroll wrapper and the stable `min-w` live in one place.
_Avoid_: Per-page table markup, copy-pasted `<thead>`/`<tbody>` blocks

**Inbound Payload Schema**:
A Zod schema in `frontend/src/domain/schemas.ts` describing one shape the C# host sends. The schemas are the single source of truth — the interfaces in `types.ts` are inferred from them with `z.infer` — and `bridge.ts` validates every inbound payload against one before handing it to the app.
_Avoid_: Casting `JSON.parse` output, `as ScheduledTaskItem[]`

**Screen Refresh Contract**:
The Windows-backed list policy in `useOsBackedLists`: subscribe once, request only the lists relevant to the active screen, accept host emissions after mutations, and expose explicit refresh Actions. Required because Windows can change scheduled tasks, restore points and backups without the app knowing.
_Avoid_: Duplicate bootstrap fetching, polling loops, refetching inside the `actionFinished` Event

**Locale-Neutral Management Record**:
An IPC record whose sortable meaning is represented by invariant primitives such as ISO 8601 timestamps and byte counts. Display formatting follows the selected application language only at the rendering edge.
_Avoid_: Host-formatted display strings, reparsing display text
