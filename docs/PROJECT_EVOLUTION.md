# VeloSys Pro — Technical Evolution & Historical Summary

**Developed by**: Envolvo Systems LTDA.  
**Version**: 1.0.0 (Release .NET 8 WPF + React 18 Standalone Staging)  
**Date**: July 23, 2026  
**Current Status**: ✅ *Resolved — `ui/` embedded into the assembly and served via WebView2 `WebResourceRequested`; single self-contained `VeloSysPro.exe`.*

---

## 📌 1. Project Overview & User Requirements

**VeloSys Pro** is a high-performance Windows optimization, network cleaning, registry backup (`.reg`), system restore point, and administrator-level tweaking desktop application.

### User Requirements (Approved & Enforced):
1. **Modern Frontend**: Transition from legacy scripts to **React 18 + TypeScript + Vite + TailwindCSS**.
2. **Design System & Aesthetics**: Dark theme (*HSL Tailwind tokens*) with zero inline style hex codes or un-tokenized attributes.
3. **Atomic Design Architecture**: Components organized into `atoms/`, `molecules/`, `organisms/`, and `pages/`.
4. **Internationalization (i18n)**: Multi-language support via Rosetta using separate JSON dictionary files (`src/domain/locales/pt_BR.json` and `en_US.json`).
5. **Code Quality Tooling**:
   - **ESLint**: Strict linter for TypeScript and React Hooks (`.eslintrc.cjs`).
   - **Prettier**: Automated code formatter with Tailwind plugin (`.prettierrc`).
   - **TypeScript (`tsc --noEmit`)**: Static type verification in build (`npm run type-check`).
6. **Testing Suite**:
   - **Vitest**: React component unit testing (`tests/unit/`).
   - **Cypress**: Automated E2E testing (`tests/e2e/`).
7. **Repository Governance (`AGENTS.md`)**: Clean Architecture, DRY, KISS, and YAGNI rules in English.

---

## 🛠️ 2. Development Trajectory & Attempted Solutions

During the integration process between the React Frontend and C# Desktop Backend, we navigated through multiple technical approaches:

### ❌ Attempt 1: Classic WPF WebBrowser (Trident / IE11 Engine)
- **Attempt**: Use WPF `System.Windows.Controls.WebBrowser`.
- **Issue**: IE11 engine does not support modern JavaScript syntax (ES6 modules `<script type="module">`, `const/let`, React 18 runtime, advanced Tailwind Flexbox/Grid). The application failed silently, rendering a **white screen**.

### ❌ Attempt 2: Micro C# HTTP Server (`HttpListener`) + Legacy Compiler (`csc.exe`)
- **Attempt**: Compile executable using legacy Windows compiler (`csc.exe` from .NET 4.0 / 2012) and run an embedded local HTTP server.
- **Issue**: 
  - Legacy `csc.exe` failed to bundle native WebView2 dependencies reliably.
  - Invoking WebView2 before the WPF Application event loop started threw: `EnsureCoreWebView2Async cannot be used before the application's event loop has started running`.
  - Resulted in white/black screen instability and required clunky `.bat` scripts.

### 🟡 Attempt 3: .NET 8 SDK WPF + WebView2 with on-disk `ui/` (virtual host mapping)
- **Implementation**:
  - Official .NET 8 WPF project structure under `desktop/`.
  - Virtual HTTPS origin mapping `https://velosys.app/index.html` via `SetVirtualHostNameToFolderMapping`, pointing at a `ui/` folder on disk next to the exe.
  - Async initialization in the WPF `Loaded` event.
- **Limitation**: Relied on the `ui/` folder existing beside the executable. Relocating `VeloSysPro.exe` broke `ui/` resolution (white screen / exit).

### ✅ Attempt 4 (CURRENT): Embedded UI served from memory
- **Implementation**:
  - The Vite bundle is compiled into the assembly as `EmbeddedResource` (`<EmbeddedResource Include="..\ui\**">`, normalized `ui/...` `LogicalName`).
  - `MainWindow.xaml.cs` serves it via `AddWebResourceRequestedFilter("https://velosys.app/*", All)` + a `WebResourceRequested` handler that streams each asset from `GetManifestResourceStream`, wrapped in a `ManagedStream` (per WebView2Feedback #2513), with per-extension `Content-Type`.
  - `IncludeNativeLibrariesForSelfExtract` bundles `WebView2Loader.dll` inside the exe.
  - The orphaned `IpcHandler` / `CommandRunner` / `BackupManager` classes are now wired into `MainWindow`, fixing IPC `payload` extraction (enables registry restore) and replacing hand-rolled JSON with `System.Text.Json`.
  - Manifest raised to `requireAdministrator` so `sfc`/`dism`/`netsh`/`reg`/`Checkpoint-Computer` actually elevate.
- **Result**: A single, self-contained `VeloSysPro.exe` that launches from any location with no external `ui/` folder.

---

## 📂 3. Repository File Structure

```
Windows Optimizer/
├── .editorconfig                 # Shared indentation & charset
├── .eslintrc.cjs                 # ESLint config
├── .prettierrc                   # Prettier config
├── .prettierignore               # Prettier ignore patterns
├── .gitignore                    # Build-artifact filters
├── AGENTS.md                     # Repository governance guidelines (in English)
├── global.json                   # Pins the .NET 8 SDK
├── build.ps1                     # Unified build script (Vite + .NET 8, single-file)
├── desktop/                      # C# .NET 8 WPF host
│   ├── App.xaml(.cs)             # WPF App startup
│   ├── MainWindow.xaml(.cs)      # WebView2 host + IPC bridge (embedded ui/)
│   ├── IpcHandler.cs             # System.Text.Json IPC parser
│   ├── CommandRunner.cs          # System command execution
│   ├── BackupManager.cs          # Backups, restore, restore points
│   ├── ManagedStream.cs          # Embedded-asset stream wrapper
│   ├── app.manifest              # UAC Manifest (requireAdministrator)
│   └── VeloSysPro.csproj         # .NET 8 WPF, single-file, ui/ embedded
├── docs/
│   ├── PRD.md                    # PRD & Handover Guide (in English)
│   └── PROJECT_EVOLUTION.md      # Consolidated evolution log (in English)
├── package.json                  # React 18, Vite, Tailwind, Vitest, Rosetta
├── src/                          # React 18 source code (Atomic Design + i18n)
├── tests/                        # Vitest (unit) and Cypress (e2e)
├── tsconfig.json                 # TypeScript compiler config
├── ui/                           # Compiled Vite bundle (embedded into the exe)
└── vite.config.js                # Vite config (base: ./, modern-only)
```

---

## 🚀 4. Commands & Execution Guide

### Development & Validation Commands:
- **Unit Tests (Vitest)**: `npm run test`
- **Type Check (TypeScript)**: `npm run type-check`
- **Linter (ESLint)**: `npm run lint`
- **Code Formatter (Prettier)**: `npm run format`
- **Full Validation**: `npm run validate`
- **Recompile Project**: `powershell -ExecutionPolicy Bypass -File build.ps1`
