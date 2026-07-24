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
  - `src/domain`: Business models, action contracts, and TypeScript interfaces (`.ts`).
  - `src/infrastructure`: IPC bridge communication with C# (`bridge.ts`).
  - `src/components`: UI components organized by Atomic Design using TypeScript (`.tsx`).

### 2. Design System & Styling Rules (Tailwind Tokens Only)
- **STRICT RULE**: ALL colors, spacings, borders, typography, and shadows MUST come strictly from the Tailwind Design System theme tokens defined in `tailwind.config.js` or standard Tailwind utility classes (`bg-primary`, `bg-success`, `bg-bgCard`, `text-textMuted`, `border-borderColor`).
- **NEVER** use inline style hex codes (e.g. `style={{ color: '#00a86b' }}`) or loose un-tokenized style attributes.

### 3. Atomic Design Component Hierarchy (TypeScript)
All components in `src/components/` MUST strictly follow this hierarchy using TypeScript interfaces (`interface Props`):
- **`atoms/`**: Indivisible UI elements (e.g., `Button.tsx`, `Badge.tsx`, `Input.tsx`, `Dot.tsx`, `Icon.tsx`).
- **`molecules/`**: Combinations of atoms (e.g., `FormField.tsx`, `HealthCard.tsx`, `LogEntry.tsx`, `SearchInput.tsx`).
- **`organisms/`**: Complex functional blocks (e.g., `ActionCard.tsx`, `TerminalConsole.tsx`, `DataTable.tsx`, `HeaderProgress.tsx`, `SidebarNav.tsx`).
- **`templates/`**: Page layout frameworks and grid structures (e.g., `MainLayout.tsx`, `DashboardGrid.tsx`).
- **`pages/`**: Full views connecting state and IPC actions (e.g., `DashboardPage.tsx`, `SchedulingPage.tsx`, `BackupPage.tsx`).

---

## 🧪 Testing Standards

### 1. Unit & Component Testing (Vitest + TypeScript)
- All atoms and molecules must have rendering and state tests using `Vitest` + `@testing-library/react`.
- Mock IPC bridge calls (`window.chrome.webview.postMessage` / `window.external.ExecuteAction`) to isolate frontend tests.

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

- **Documentation Sub-Site & Icon Extraction Standards**: When adding or updating a Docusaurus documentation portal in a subfolder (`website/`), MUST import the project version directly from the root `package.json` (`../../../package.json`), strictly mirror the host application's Tailwind design system tokens (`#12141c`, `#181c28`, `#1c1f2b`, `#2a2f42`, `#2d6edc`) in `custom.css`, use `persist-credentials: true` in release push workflows, and extract multi-resolution Windows `.ico` assets using stream image decoders (`System.Drawing.Image::FromStream()`) to prevent corrupted PNG logo output.
- **Full-Stack Cross-Layer Synchronization**: In hybrid desktop applications (C# .NET 8 WPF + React WebView2), any modification to i18n keys, IPC event contracts, payload schemas, or pre-commit validation MUST synchronously update both the C# backend emitter classes (`desktop/*.cs`) and the React TS frontend handler components (`src/`), and MUST be validated with both `npm run validate` and `dotnet build`.
- **Environment-Aware Interactive Question Tools**: When soliciting design feedback, feature selection, or presenting multi-option choices, ALWAYS use the environment's native interactive question tool instead of static markdown text lists (Antigravity: `ask_question`, Claude Code: `AskUserQuestion`, Codex: `AskUser`). Prefix primary recommendations with `(Recommended)` / `(Recomendado)` and set multi-select checkboxes (`is_multi_select: true`) when multiple options apply.
- **Empirical Windows Process-Boundary Validation**: When changing native Windows command execution, redirected output, logging, or completion state, NEVER assume UTF-8 or infer success solely from control flow. Detect the current Windows OEM encoding, preserve stdout/stderr and exit-code semantics, and validate the boundary with at least one representative localized command before changing React display logic; then run `npm run validate`, `dotnet build desktop/VeloSysPro.csproj`, and the affected E2E flow.
- **End-to-End GitHub Governance Validation**: When changing GitHub Actions workflows, required checks, Dependabot configuration, branch rulesets, or semantic-release behavior, MUST treat the GitHub-hosted runner and bot-authored PRs as integration boundaries: preserve stable required-check names, explicitly align line endings and cache paths across Windows steps, constrain dependency-update grouping and bot-title exceptions without weakening human validation, and prevent release automation from writing generated files back to the protected branch. Validate locally with `npm run validate`, `npm run build`, `dotnet build desktop/VeloSysPro.csproj -c Release`, and `dotnet test desktop.Tests/VeloSysPro.Tests.csproj -c Release`; then verify a real human PR, a representative Dependabot PR, `gh ruleset check --default`, and the post-merge tag, GitHub Release, and installer artifact before declaring the governance change complete.
