# 📄 Product Requirements Document (PRD) & Handover Guide: VeloSys Pro

**Product**: VeloSys Pro  
**Company**: Envolvo Systems LTDA.  
**Version**: 1.0.0 (Staging / AI Agent Handover)  
**Date**: July 23, 2026  
**Executable Status**: ✅ **Resolved — `ui/` embedded as assembly resources and served via WebView2 `WebResourceRequested`, producing a genuinely single, self-contained `VeloSysPro.exe`.**  

---

## 🎯 1. Document Objective (For the Next AI Agent / Engineer)

This Product Requirements Document (PRD) consolidates **all requirements, architectural decisions, historical attempts, user complaints, known technical issues, and necessary next steps** so that another AI agent or software engineer can seamlessly resume development without loss of context or redundant work.

---

## 🗣️ 2. User Complaints, Feedback & Strict Directives

The user provided direct feedback and quality constraints that **MUST** be strictly enforced without exception:

1. **Absolute Rejection of Clunky Workarounds**:
   - *User Quote*: *"How can you tell me we'll have to use the app in dist_app? And on top of that give me that horrible suggestion of the .bat to open the app... My goodness..."*
   - *Directive*: **NEVER** suggest `.bat` launcher scripts or instruct the user to navigate into subfolders (`dist_app/`) to open the desktop application. The final deliverable MUST be a single, clean executable `VeloSysPro.exe`.

2. **Mandatory Repository Cleanliness & Sanitation**:
   - *User Quote*: *"Could you do a cleanup on the project?"* and *"Is it right to have all these files in the project?"*
   - *Directive*: Keep the root folder pristine. Delete legacy/dead files (`Program.cs`, loose DLLs, temporary `.bat` scripts, `.pdb`, `.deps.json`). Never leave build garbage exposed in the root directory.

3. **Strict Requirement for Real React 18 (No Raw Fallback HTML)**:
   - *User Quote*: *"Our HTML got huge and at no point did we use React components or Tailwind..."*
   - *Directive*: The desktop app **MUST** render the production React 18 bundle built by Vite in `ui/` using the modern Microsoft Edge Chromium WebView2 engine. Never fall back to static IE11 HTML.

4. **Transparency & Mandatory Visual Verification**:
   - *User Quote*: *"Before returning a message saying 'done, now I finished', do a visual test..."* and *"End by saying that it still hasn't worked out..."*
   - *Directive*: Be 100% transparent when an executable fails in the user's local environment. Never declare false success without verified runtime success.

---

## 🏗️ 3. Product Specifications & Technical Architecture

### 3.1. Frontend Stack
- **Framework**: React 18 + TypeScript + Vite.
- **Styling**: TailwindCSS strictly enforcing HSL Design System tokens in `tailwind.config.js` (Dark Theme: `bgMain`, `bgSidebar`, `bgCard`, `primary`, `success`, `purple`, `warning`, `danger`, `textMain`, `textMuted`). Zero inline style hex codes.
- **Component Hierarchy**: **Atomic Design**:
  - `src/components/atoms/`: `Button.tsx`, `Badge.tsx`, `Dot.tsx`, `Input.tsx`.
  - `src/components/molecules/`: `HealthCard.tsx`.
  - `src/components/organisms/`: `ActionCard.tsx`, `TerminalConsole.tsx`, `SidebarNav.tsx`.
  - `src/components/pages/`: `DashboardPage.tsx`.
- **Internationalization (i18n)**: Rosetta engine in `src/domain/i18n.ts` consuming separate JSON locale files:
  - `src/domain/locales/pt_BR.json`
  - `src/domain/locales/en_US.json`
- **Code Quality Tooling**:
  - **ESLint**: `.eslintrc.cjs` configured for TypeScript and React Hooks.
  - **Prettier**: `.prettierrc` with `prettier-plugin-tailwindcss`.
  - **TypeScript (`tsc --noEmit`)**: Type checking script `npm run type-check`.
  - **Unit Testing**: Vitest (`npm run test`).
  - **E2E Testing**: Cypress (`cypress/`).

### 3.2. Desktop Backend Stack (C# .NET 8 WPF Host)
- **Project File**: `VeloSysPro.csproj` (`net8.0-windows`, native WPF).
- **Embedded Browser**: **`Microsoft.Web.WebView2`** (Microsoft Edge Chromium).
- **Virtual Host Name Mapping**: Maps the `ui/` directory to secure virtual HTTPS origin `https://velosys.app/index.html` via `SetVirtualHostNameToFolderMapping`.
- **Bidirectional IPC Communication**:
  - *React -> C#*: `window.chrome.webview.postMessage({ action, payload })`.
  - *C# -> React*: `webView.CoreWebView2.ExecuteScriptAsync("window.onLogReceived('msg', 'type')")`.
- **System Actions (Elevated Processes / Subprocesses)**:
  - `ipconfig /flushdns` (DNS Flush).
  - `cleanmgr /verylowdisk` (Disk Cleanup).
  - `sfc /scannow` (System File Checker).
  - `dism /online /cleanup-image /restorehealth` (DISM Repair).
  - `netsh int tcp set global rss=enabled` (Gaming Network Tweaks).
  - `reg export` (Registry Export in `backups/backup_rede_*.reg`).
  - `Checkpoint-Computer` (System Restore Point).

---

## 🚨 4. Historical Technical Issues, Limitations & Lessons Learned

To prevent the next AI agent from making the same mistakes, here are the documented technical pitfalls:

1. **WPF WebBrowser Control Incompatibility (Trident / IE11)**:
   - *Issue*: Legacy WPF `System.Windows.Controls.WebBrowser` wraps IE11. IE11 does not support ES6 modules `<script type="module">` or React 18 syntax, causing silent script execution failure and a **white screen**.
   - *Mandatory Fix*: Use strictly **`Microsoft.Web.WebView2` (Edge Chromium)**.

2. **WPF Event Loop Initialization Trap**:
   - *Error*: `EnsureCoreWebView2Async cannot be used before the application's event loop has started running`.
   - *Cause*: Calling `EnsureCoreWebView2Async` inside `MainWindow()` constructor.
   - *Mandatory Fix*: Call `EnsureCoreWebView2Async` strictly inside the `Loaded` event handler (`MainWindow_Loaded`).

3. **Local File Protocol (`file://`) Security Blocking**:
   - *Issue*: Loading `file:///.../ui/index.html` blocks cross-origin assets and ES6 modules in Chromium.
   - *Mandatory Fix*: Map the `ui/` folder to `https://velosys.app/` using `SetVirtualHostNameToFolderMapping`.

4. **Root Executable Launch Failure (RESOLVED)**:
   - *Former Symptom*: The build depended on a `ui/` folder next to the `.exe`; when relocated, path resolution for `ui/` failed and the app exited/showed a white screen.
   - *Resolution (implemented)*: The Vite bundle is now compiled into the assembly as `EmbeddedResource` (`<EmbeddedResource Include="..\ui\**">` with a normalized `ui/...` `LogicalName`). At runtime `MainWindow.xaml.cs` serves it from memory via WebView2's `AddWebResourceRequestedFilter` + `WebResourceRequested` (using a `ManagedStream` wrapper per WebView2Feedback #2513). Combined with `IncludeNativeLibrariesForSelfExtract`, the published `VeloSysPro.exe` is a **single self-contained file** with no external `ui/` folder or loose `WebView2Loader.dll`.

---

## 📑 5. Current Repository File Tree

```
Windows Optimizer/
├── .editorconfig                 # Shared indentation & charset settings
├── .eslintrc.cjs                 # ESLint TypeScript/React config
├── .prettierrc                   # Prettier + Tailwind config
├── .prettierignore               # Prettier ignore patterns
├── .gitignore                    # Ignores build artifacts (bin/obj/dist/ui/*.exe...)
├── AGENTS.md                     # Repository guidelines (in English)
├── global.json                   # Pins the .NET 8 SDK
├── build.ps1                     # Unified build script (Vite + .NET 8, single-file)
├── desktop/                      # C# .NET 8 WPF host
│   ├── App.xaml(.cs)             # WPF Application entry
│   ├── MainWindow.xaml(.cs)      # WebView2 host + IPC bridge (serves embedded ui/)
│   ├── IpcHandler.cs             # System.Text.Json IPC parser (action + payload)
│   ├── CommandRunner.cs          # System command execution
│   ├── BackupManager.cs          # Registry backups, restore, restore points
│   ├── ManagedStream.cs          # Embedded-asset stream wrapper (WebView2 #2513)
│   ├── app.manifest              # UAC Manifest (requireAdministrator)
│   ├── assets/app.ico            # Application icon
│   └── VeloSysPro.csproj         # .NET 8 WPF, single-file, ui/ embedded
├── docs/
│   ├── PRD.md                    # THIS HANDOVER DOCUMENT
│   └── PROJECT_EVOLUTION.md      # Consolidated evolution log
├── package.json                  # React 18, Vite, Tailwind, Vitest, Rosetta
├── src/                          # React 18 source (Atomic Design + i18n)
│   └── components/               # atoms, molecules, organisms, templates, pages
├── tests/                        # Vitest (unit) & Cypress (e2e)
├── tsconfig.json                 # TypeScript compiler configuration
├── ui/                           # Compiled Vite bundle (embedded into the exe at build)
└── vite.config.js                # Vite build config (base: ./, modern-only)
```

---

## 📋 6. AI Agent Handover Checklist

When taking over the project, follow this exact sequence:

- [ ] **1. Read and Respect `AGENTS.md` Rules**: Enforce TypeScript interfaces (`interface Props`), HSL design system tokens, and zero propTypes.
- [ ] **2. Investigate & Fix Root Executable Launch Issue**:
  - Audit `ui/` path resolution in `MainWindow.xaml.cs` (test robust fallback between `BaseDirectory`, `CurrentDirectory`, and executable directory).
  - Ensure double-clicking `VeloSysPro.exe` directly in root launches the application with 100% success without exiting and without requiring `.bat` scripts.
- [ ] **3. Run Validation Pipeline**:
  - `npm run validate` (Verifies TypeScript, ESLint, and Vitest unit tests pass with 0 errors).
  - `powershell -ExecutionPolicy Bypass -File build.ps1` (Compiles React frontend and publishes .NET 8 WPF host).
- [ ] **4. Perform Empirical Testing**: Visually verify that the React 18 dark theme application loads with PT/EN language switcher and functional IPC actions.
