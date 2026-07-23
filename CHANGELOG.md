# Changelog

All notable changes to VeloSys Pro are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Bilingual host logs** — optimization/status messages emitted by the C# host are
  now i18n keys translated in React, so the live terminal follows the selected
  language (PT/EN) and re-localizes existing lines on switch.
- **Headless CLI mode** — `VeloSysPro.exe --task=<quick|full|gaming|revert>` runs an
  optimization with no window, for use by the scheduler.
- **Task scheduling** — create/list/delete recurring optimizations via the Windows
  Task Scheduler (`schtasks`), each running the exe headlessly.
- **System Restore Points screen** — list, create, and roll back restore points
  (rollback is gated behind a double confirmation since it reboots).
- **Settings screen** — persistent language preference (`%LOCALAPPDATA%\VeloSysPro\
  settings.json`) and a "safety backup before optimizing" toggle honored by the host.
- **More optimization tools** — clear the Windows Update cache, clean Prefetch, and a
  physical-disk SMART/health report.
- **Update check** — on launch the app queries the GitHub Releases API and shows a
  dismissible banner with a download link when a newer version exists.
- **Installer** — Inno Setup script that installs the single exe, adds shortcuts and an
  uninstaller, and installs the Evergreen WebView2 Runtime when it is missing.
- **CI** — GitHub Actions runs type-check, ESLint, Vitest unit tests, Cypress E2E, and
  the .NET build on every PR to `main`/`master`; tagged releases build and attach the
  installer.

### Changed

- Extracted an `Optimizer` service and wired the previously-orphaned service classes
  into `MainWindow`; removed duplicated logic.
- Registry backup list is serialized with `System.Text.Json` (safe escaping).
- Dropped `@vitejs/plugin-legacy` and `terser` — WebView2 is modern Edge Chromium.
- Migrated ESLint to flat config (`eslint.config.js`).

### Fixed

- IPC now parses `action` **and** `payload` via `System.Text.Json`, enabling registry
  restore (previously dead code).

## [1.0.0] - 2026-07-23

### Added

- Initial release: React 18 + TypeScript + Vite + Tailwind UI hosted in a .NET 8 WPF
  app via Microsoft Edge WebView2, packaged as a single self-contained `VeloSysPro.exe`
  with the UI embedded as assembly resources.
- Quick/Full optimizations, Gaming Mode, Revert Defaults, registry backup & restore,
  and system restore point creation. Bilingual PT-BR/EN interface.
