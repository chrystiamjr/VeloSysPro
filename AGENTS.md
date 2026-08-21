# AGENTS.md — VeloSys Pro Project Guidelines & Architecture

## 📌 Project Premise
**VeloSys Pro** is a high-performance Windows optimization, maintenance, gaming tweak, registry backup, and system recovery desktop application.
Developed by **Envolvo Systems LTDA.** using a modern hybrid architecture:
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS (Design System Tokens) + Atomic Design + Vitest + Cypress.
- **Backend**: C# .NET 8 WPF Host with secure WebView2 IPC communication.

---

## 🏗️ Architecture & Coding Standards

### 1. Clean Architecture, DRY, KISS, and YAGNI
- **KISS (Keep It Simple, Stupid)**: Maintain clear, straightforward implementations without unnecessary over-engineering.
- **YAGNI (You Aren't Gonna Need It)**: Implement strictly what is required for the current feature scope.
- **DRY (Don't Repeat Yourself)**: Reuse atomic components and centralized utility modules.
- **Clean Architecture Layers**:
  - `frontend/src/domain`: Business models, action contracts, and TypeScript interfaces (`.ts`).
  - `frontend/src/infrastructure`: IPC bridge communication with C# (`bridge.ts`).
  - `frontend/src/components`: UI components organized by Atomic Design using TypeScript (`.tsx`).

### 2. Design System & Styling Rules (Tailwind Tokens Only)
- **STRICT RULE**: ALL colors, spacings, borders, typography, and shadows MUST come strictly from the Tailwind Design System theme tokens defined in `frontend/tailwind.config.js` or standard Tailwind utility classes (`bg-primary`, `bg-success`, `bg-bgCard`, `text-textMuted`, `border-borderColor`).
- **NEVER** use inline style hex codes (e.g. `style={{ color: '#00a86b' }}`) or loose un-tokenized style attributes.

### 3. Atomic Design Component Hierarchy (TypeScript)
All components in `frontend/src/components/` MUST strictly follow this hierarchy using TypeScript interfaces (`interface Props`):
- **`atoms/`**: Indivisible UI elements (e.g., `Button.tsx`, `Badge.tsx`, `Input.tsx`, `Dot.tsx`, `Icon.tsx`).
- **`molecules/`**: Combinations of atoms (e.g., `FormField.tsx`, `HealthCard.tsx`, `LogEntry.tsx`, `SearchInput.tsx`).
- **`organisms/`**: Complex functional blocks (e.g., `ActionCard.tsx`, `TerminalConsole.tsx`, `DataTable.tsx`, `HeaderProgress.tsx`, `SidebarNav.tsx`).
- **`templates/`**: Page layout frameworks and grid structures (e.g., `MainLayout.tsx`, `DashboardGrid.tsx`).
- **`pages/`**: Full views connecting state and IPC actions (e.g., `DashboardPage.tsx`, `SchedulingPage.tsx`, `BackupPage.tsx`).

---

## 🧪 Testing Standards

### 1. Unit & Component Testing (Vitest + TypeScript)
- All atoms and molecules must have rendering and state tests using `Vitest` + `@testing-library/react`.
- Mock `window.chrome.webview.postMessage` and the WebView2 `message` Event listener to isolate frontend tests.

### 2. End-to-End Testing (Cypress + TypeScript)
- Test complete E2E flows: tab navigation, trigger actions, live log displays, and backup table sorting.
- Spy/stub IPC calls to verify payload integrity and visual responsiveness.

---

## 🚫 Do's and Don'ts

### ✅ Do's:
- **ALWAYS** use TypeScript interfaces (`interface ComponentProps`) for all component props. Never use runtime `propTypes`.
- **ALWAYS** use Tailwind Design System classes (`bg-primary`, `bg-success`, `text-textMain`, `border-borderColor`).
- Handle all IPC communication with graceful error handling and fallbacks.

### 🛠️ Desktop & Build Sanitation Guardrails
- **SINGLE EXECUTABLE DELIVERABLE**: Always produce a clean, standalone executable (`VeloSysPro.exe`). **NEVER** suggest `.bat` launcher scripts or ask the user to navigate nested subfolders to open their app.
- **REPOSITORY CLEANLINESS**: Automatically purge loose compiler DLLs (`*.dll`), debug symbols (`*.pdb`), dependency graphs (`*.deps.json`), and legacy scripts from the root directory.
- **WPF WEBVIEW2 EVENT LOOP**: Always invoke `EnsureCoreWebView2Async` inside the WPF `Loaded` event handler (`MainWindow_Loaded`). Never call it inside the `MainWindow` constructor before the WPF event loop starts.
- **DOCUMENTATION LANGUAGE**: All PRD, architecture handover, and technical specification files in `docs/` MUST be written in English.

### ❌ Don'ts:
- **DO NOT** use loose inline style objects or inline hex color strings (`style={{ color: '#123456' }}`).
- **DO NOT** use propTypes; use TypeScript interfaces.
- **DO NOT** embed system calls directly inside atomic UI components.
- **DO NOT** create monolithic components; break them down into atoms/molecules/organisms.
- **DO NOT** disable test assertions or ignore build warnings.
- **DO NOT** leave `.bat` launcher scripts or loose build artifacts in the root directory.

---

## ⚠️ Gotchas & Special Considerations
1. **WebView2 IPC Mocking**: In Vitest and Cypress test environments, `window.chrome.webview` is not available natively. The infrastructure layer (`bridge.ts`) automatically mocks message sending during tests.
2. **UAC Administrator Rights**: System commands (`sfc`, `dism`, `netsh`, `Checkpoint-Computer`) require elevated privileges, managed by `app.manifest` in the C# host application.

---

## 📝 Learned Rules

| Regra / Título | Caminho (Documento Completo) | Keywords / Resumo |
| :--- | :--- | :--- |
| **Documentation Sub-Site & Theme Standards** | [docusaurus-theme-standards.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/docusaurus-theme-standards.md) | `docusaurus, website, theme, color mode, icons, build` |
| **Full-Stack Cross-Layer Synchronization** | [fullstack-sync.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/fullstack-sync.md) | `i18n, IPC, C#, WPF, React, TypeScript, validation` |
| **Environment-Aware Interactive Question Tools** | [interactive-questions.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/interactive-questions.md) | `AskUser, recommendations, multi-select, native UI` |
| **Empirical Windows Process-Boundary Validation** | [windows-process-boundary.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/windows-process-boundary.md) | `OEM encoding, stdout, stderr, exit codes, Windows processes` |
| **End-to-End GitHub Governance Validation** | [github-governance-validation.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/github-governance-validation.md) | `GitHub Actions, PRs, rulesets, Dependabot, releases` |
| **Multi-Stack Repository Audit & Sanitization** | [multistack-repo-sanitization.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/multistack-repo-sanitization.md) | `cleanup, gitignore, build artifacts, multi-stack validation` |
| **Responsive Management Layout Guardrails** | [responsive-management-layouts.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/responsive-management-layouts.md) | `responsive cards, full-width actions, table overflow, sidebar overlay` |
| **Locale-Neutral Data at Process & IPC Boundaries** | [locale-neutral-boundary-data.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/locale-neutral-boundary-data.md) | `locale, culture, schtasks, Get-ScheduledTask, ToString, sorting, badge` |
| **Falsifiable Test Guards** | [falsifiable-test-guards.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/falsifiable-test-guards.md) | `vacuous test, assert command, injected regression, per-field probe, StrictMode` |
| **Freshness of OS-Backed Lists** | [os-backed-list-freshness.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/os-backed-list-freshness.md) | `refresh, refetch on navigation, stale list, action lock, empty state` |
| **Theming Native Form Controls in WebView2** | [webview2-native-control-theming.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/webview2-native-control-theming.md) | `color-scheme, WebView2, select, appearance-none, dark theme, pickers` |
| **Detect a Tweak's Intent, Never Literal Equality** | [detect-intent-not-equality.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/detect-intent-not-equality.md) | `ITweak, Detect, Apply, ServiceTweak, StartType, hardened system, no-op` |
| **Report an Outcome Where the Action Was Taken** | [report-outcomes-where-acted.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/report-outcomes-where-acted.md) | `actionFinished, toast, log panel, mutation filter, outcome, screen` |
| **Bounded Streaming Buffers & IPC Event Windows** | [bounded-streaming-buffers.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/bounded-streaming-buffers.md) | `IPC, ring buffer, useLogBuffer, streaming, logs, stdout, memory safety` |
| **Semantic Version Resolution across Boundaries** | [semver-boundary-resolution.md](file:///C:/Users/chrys/OneDrive/Desktop/Windows%20Optimizer/.agents/rules/semver-boundary-resolution.md) | `SemanticVersion, SemVer, GitHub Releases, AssemblyInformationalVersionAttribute` |
| **Absence of an Error Is Not Success** (global) | [absence-of-error-is-not-success.md](file:///C:/Users/chrys/.agents/rules/absence-of-error-is-not-success.md) | `exit code, warning, silent refusal, UAC, elevation, read-back, verify the artifact` |

---

## Agent skills

### Issue tracker

Tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository layout (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

