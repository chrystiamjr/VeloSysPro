# VeloSys Pro — Architecture

VeloSys Pro is a single, self-contained Windows desktop executable that pairs a **React 18 +
TypeScript** user interface with a **C# .NET 8 WPF** host through **Microsoft Edge WebView2**. The
UI is compiled by Vite and embedded into the assembly as resources, so the shipped `VeloSysPro.exe`
carries its own front end with no external `ui/` folder.

This document describes how the two halves communicate, how ownership is divided, and the invariants
that keep an elevated, bilingual optimizer safe and testable. Domain vocabulary is defined in
[`CONTEXT.md`](CONTEXT.md); the two load-bearing decisions are recorded as ADRs
[0001](docs/adr/0001-use-webview2-event-envelopes.md) and
[0002](docs/adr/0002-use-structured-validated-actions.md).

---

## 1. High-level shape

```
┌──────────────────────────────────────────────────────────────────────┐
│  React 18 + TypeScript UI  (Atomic Design, Tailwind tokens, Rosetta)   │
│                                                                        │
│   pages ── hooks: useExecutionLifecycle · useOsBackedLists ·           │
│                   usePreferences                                       │
│                              │                                         │
│              src/infrastructure/bridge.ts  (the one IPC seam)          │
└───────────────┬───────────────────────────────────┬──────────────────┘
     Actions ▲  │ postMessage({action, payload})     │ ▼ Events
   (intentions) │                                     │ (facts, one
                │        WebView2 web messaging        │  `message` listener)
┌───────────────▼───────────────────────────────────┴──────────────────┐
│  C# .NET 8 WPF Host                                                     │
│                                                                        │
│   IpcHandler ─▶ ActionHost ─▶ domain services ─▶ IpcEventEmitter       │
│   (parse)      (validate,     (Optimizer,         ({event,payload}      │
│                route, lock)    Backup/Restore,     envelopes)           │
│                                Scheduler, …)                            │
└──────────────────────────────┬─────────────────────────────────────────┘
                    Process execution (elevated)
                               │
              Windows: sfc · dism · netsh · schtasks · reg · WMI
```

The executable always runs elevated (`requireAdministrator`, see `desktop/app.manifest`) because the
optimizations invoke privileged system tools.

---

## 2. IPC model — Actions in, Events out

The React↔host boundary is deliberately asymmetric and named after intent (`CONTEXT.md`):

| Direction | Name | Shape | Transport |
| :-- | :-- | :-- | :-- |
| UI → host | **Action** | `{ action, payload }` | `window.chrome.webview.postMessage` |
| host → UI | **Event** | `{ event, payload }` | `PostWebMessageAsJson`, one `message` listener |

- **Actions** are *intentions* the UI asks the host to perform or answer. Payloads are **structured
  and validated at the host seam** (ADR 0002), not strings validated per-module.
- **Events** are *facts* the host emits for the UI to observe. A single native channel concentrates
  serialization and validation (ADR 0001), replacing the old per-callback `window.onX` globals.

Because the UI and host ship as one executable, both stacks migrate together — there is no legacy
string-payload compatibility to maintain.

### Canonical Event names (`desktop/IpcEvents.cs`)

`logReceived` · `statusUpdated` · `progressUpdated` · `backupsLoaded` · `tasksLoaded` ·
`restorePointsLoaded` · `settingsLoaded` · `updateAvailable` · `actionFinished`

---

## 3. Backend (C# `desktop/`)

### The Action seam — `ActionHost`

`ActionHost` owns everything that happens between a parsed inbound message and an authoritative
completion:

- **Routing** — a `Dictionary<string, Func<JsonElement, bool>>` maps each `SystemActions` name to a
  typed handler; unknown Actions throw and finish `ok: false`.
- **Validation** — payloads are read through `ReadString` / `ReadInt` / `ReadObject<T>` at this one
  seam, so a malformed Action is diagnosed, not passed downstream.
- **Mutation exclusion** — mutating Actions are gated by an `Interlocked` flag: **one mutation at a
  time**, while reads stay concurrent (ADR 0002). An overlapping mutation is rejected with
  `ok: false` and never touches the system.
- **Refresh-after-success** — `MutateAndRefresh` runs the mutation and then re-emits the affected
  **Management Records** (e.g. a new backup → `backupsLoaded`). Failed mutations do **not** refresh.
- **Authoritative completion** — every Action, success or failure, ends by emitting
  `actionFinished { action, ok }`. This — not a progress value — is what releases the UI lock.

`IpcHandler` parses inbound Actions; `IpcEventEmitter` serializes each fact into the
`{ event, payload }` envelope (camelCase) through a transport delegate that the WPF host wires to
WebView2 and that tests capture directly.

### Domain services (deep modules)

| Module | Responsibility |
| :-- | :-- |
| `Optimizer` | Runs the named **Optimization Plans** — `Quick`, `Full`, `Gaming`, `Revert` — plus `ClearUpdateCache`, `CleanPrefetch`, `ReportDiskHealth`. Success is derived from **exit codes**, not stderr presence. Honors the safety-backup preference. |
| `RegistryBackupManager` | Exports/imports TCP/IP registry `.reg` backups; lists them as Management Records. |
| `SystemRestoreManager` | Lists, creates, and rolls back Windows System Restore points (rollback reboots). |
| `SchedulerManager` + `SchedulePolicy` | Create/list/delete Task Scheduler entries that run the exe headlessly. `SchedulePolicy` owns schedule validation, normalization, task-name encoding/decoding, and **locale-neutral** fallback states (`Unknown`). |
| `SettingsManager` | Persists preferences in `%LOCALAPPDATA%\VeloSysPro\settings.json`. |
| `UpdateChecker` | Compares the assembly version to the latest GitHub release. |

### Infrastructure

- `CommandRunner` / `ICommandRunner` — executes native tools, capturing stdout/stderr **decoded with
  the system OEM code page** (`NativeConsoleEncoding`, e.g. CP850) so localized output is not
  mojibaked, and returning exit codes. The interface lets tests substitute in-memory fakes.
- `IStatusSink` / `FileStatusSink` — the log/status/progress sink. In-app it feeds Events; in
  **headless CLI mode** (`VeloSysPro.exe --task=<quick|full|gaming|revert>`, used by the scheduler)
  it writes to a file.
- `ManagedStream` + `MainWindow` — serve the embedded `ui/` bundle from memory via WebView2
  `WebResourceRequested` under `https://velosys.app/`, so the release needs no `ui/` folder on disk.

---

## 4. Frontend (React `src/`)

### The IPC seam — `bridge.ts` + Zod schemas

`src/infrastructure/bridge.ts` is the single module that talks to the host. It:

- sends Actions via `sendAction(action, payload?)`;
- registers **one** `message` listener, parses each `{ event, payload }` envelope, and dispatches to
  per-event subscribers;
- **runtime-validates every inbound payload** against Zod schemas before handing it to state.

`src/domain/schemas.ts` defines those schemas once and `domain/types.ts` re-exports the inferred
types, so the runtime check and the compile-time type can never disagree. An invalid Event is logged
and ignored — it never blanks the screen.

### State ownership (hooks)

React state is split into three focused owners instead of one mega-component:

| Hook | Owns |
| :-- | :-- |
| `useExecutionLifecycle` | The execution lock, mirroring the host: `runMutation` acquires it and only the matching `actionFinished` Event releases it; `runRead` never locks; progress is visual-only. |
| `useOsBackedLists` | The **Management Records** (backups, tasks, restore points). Refreshes on relevant navigation and after successful mutations; a failed read **keeps the last valid list** rather than blanking it. |
| `usePreferences` | Settings. Updates are optimistic, but the host re-emits the persisted settings after acceptance or rejection, which wins. |

### UI conventions

- **Atomic Design** (`atoms → molecules → organisms → templates → pages`) with TypeScript prop
  interfaces.
- **Tailwind design tokens only** — no inline hex/colors.
- **i18n** via Rosetta with nested keys mirrored in `pt_BR.json` / `en_US.json`. Host log/status
  messages travel as **i18n keys + args** and are translated in React, so the live console follows
  the selected language.

---

## 5. Packaging & delivery

- **Single executable** — `build.ps1` builds the Vite bundle, embeds it as assembly resources, and
  publishes a self-contained, single-file `VeloSysPro.exe` (native WebView2 loader self-extracts).
- **Installer** — `installer/VeloSysPro.iss` (Inno Setup) installs the exe, adds shortcuts, and
  bootstraps the Evergreen **WebView2 Runtime** when missing.
- **Releases** — Conventional Commits (`type(scope): …`, enforced by commitlint) drive
  **semantic-release** on every push to `main`: it derives the version, runs `sync-version.mjs`
  across all version files, builds the installer, updates `CHANGELOG.md`, and publishes a GitHub
  Release. Pre-1.0, breaking → minor, feat/fix → patch.
- **CI** — GitHub Actions runs frontend validation + Cypress E2E and the .NET build + xUnit tests on
  every PR; `main` is protected and PR-only.

---

## 6. Cross-cutting invariants

- **Change both stacks together.** Any change to an Action/Event contract, payload, or i18n key must
  update the C# emitters/handlers, the TypeScript schemas/handlers, and both validation stacks in the
  same change.
- **Validate at the seam.** Host payloads are validated in `ActionHost`; frontend Event payloads are
  validated in `bridge.ts` before replacing state.
- **Serialize mutations, keep reads concurrent.** Elevated-operation safety must not depend solely on
  the UI.
- **Locale-neutral boundary data.** Management Records cross IPC as ISO timestamps, byte counts, and
  structured schedule fields — never localized OS display strings.
- **Refresh only after success.** OS-backed lists refresh on navigation and successful mutations, and
  retain their last valid state when a read fails.
