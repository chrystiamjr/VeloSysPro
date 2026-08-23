## [0.4.3](https://github.com/chrystiamjr/VeloSysPro/compare/v0.4.2...v0.4.3) (2026-08-23)

### Bug Fixes

* **optimize:** recommend only what primary sources support ([#49](https://github.com/chrystiamjr/VeloSysPro/issues/49)) ([a245553](https://github.com/chrystiamjr/VeloSysPro/commit/a245553e2fcc1dba24bd99d1270f3ab47b388b3c))

## [0.4.2](https://github.com/chrystiamjr/VeloSysPro/compare/v0.4.1...v0.4.2) (2026-08-23)

### Bug Fixes

* **snapshot:** stop pairing unrelated readings as a batch result ([#48](https://github.com/chrystiamjr/VeloSysPro/issues/48)) ([02daeb5](https://github.com/chrystiamjr/VeloSysPro/commit/02daeb5c37892702378c0e8264b3a8c1b8c9e5cc))

## [0.4.1](https://github.com/chrystiamjr/VeloSysPro/compare/v0.4.0...v0.4.1) (2026-08-22)

### Bug Fixes

* **snapshot:** resolve the restart hint after an actual restart ([#47](https://github.com/chrystiamjr/VeloSysPro/issues/47)) ([646d7ed](https://github.com/chrystiamjr/VeloSysPro/commit/646d7ed17880ed81ab8276a65b63acf335a0e3dc))

## [0.4.0](https://github.com/chrystiamjr/VeloSysPro/compare/v0.3.0...v0.4.0) (2026-08-21)

### Features

* **debloat:** allow-listed Appx removal with per-package results ([#45](https://github.com/chrystiamjr/VeloSysPro/issues/45)) ([b0bb69f](https://github.com/chrystiamjr/VeloSysPro/commit/b0bb69f9b1aae4e7a3d12760e73ab336eb2acc86))

## [0.3.0](https://github.com/chrystiamjr/VeloSysPro/compare/v0.2.0...v0.3.0) (2026-08-21)

### Features

* **arch:** deepen IPC, recovery checkpoints, and state hooks ([#46](https://github.com/chrystiamjr/VeloSysPro/issues/46)) ([f5271a1](https://github.com/chrystiamjr/VeloSysPro/commit/f5271a17de6e2d173005188ffc75a31dd95fbe0c))

## [0.2.0](https://github.com/chrystiamjr/VeloSysPro/compare/v0.1.6...v0.2.0) (2026-08-21)

### Features

* **optimize:** reversible Tweak framework with a 14-Tweak catalog ([#44](https://github.com/chrystiamjr/VeloSysPro/issues/44)) ([3574752](https://github.com/chrystiamjr/VeloSysPro/commit/35747529b28aed5f320e1f87625b360eafe94a98))

## [0.1.6](https://github.com/chrystiamjr/VeloSysPro/compare/v0.1.5...v0.1.6) (2026-07-25)

### Bug Fixes

* **ci:** support Dependabot commits and minor features ([#34](https://github.com/chrystiamjr/VeloSysPro/issues/34)) ([e7f8e11](https://github.com/chrystiamjr/VeloSysPro/commit/e7f8e118b5abd81842c4c98d8ea60c5e6134a13a))

## [0.1.5](https://github.com/chrystiamjr/VeloSysPro/compare/v0.1.4...v0.1.5) (2026-07-25)

### Bug Fixes

* **ui:** refresh stale lists, theme native controls, validate IPC payloads ([#27](https://github.com/chrystiamjr/VeloSysPro/issues/27)) ([03e5695](https://github.com/chrystiamjr/VeloSysPro/commit/03e56957c81d8f52c791277e22fbd478dbf96fd1))

## [0.1.4](https://github.com/chrystiamjr/VeloSysPro/compare/v0.1.3...v0.1.4) (2026-07-25)

### Features

* **ui:** add sortable paginated DataTable to management screens ([#23](https://github.com/chrystiamjr/VeloSysPro/issues/23)) ([2d168ea](https://github.com/chrystiamjr/VeloSysPro/commit/2d168ea32a84123b9dc500ac49d7b24d70fef870))

## [0.1.3](https://github.com/chrystiamjr/VeloSysPro/compare/v0.1.2...v0.1.3) (2026-07-24)

### Features

* expand test coverage and automate release bumps ([#15](https://github.com/chrystiamjr/VeloSysPro/issues/15)) ([651ac44](https://github.com/chrystiamjr/VeloSysPro/commit/651ac445d52dbd2b6510966fba8431a20af4bee4))

### Bug Fixes

* **ci:** restore documentation deployment ([#16](https://github.com/chrystiamjr/VeloSysPro/issues/16)) ([ec57201](https://github.com/chrystiamjr/VeloSysPro/commit/ec57201be292c5c06c26fb04b826428eb69426d8))
* **ui:** improve responsive layouts and navigation ([#19](https://github.com/chrystiamjr/VeloSysPro/issues/19)) ([95efd43](https://github.com/chrystiamjr/VeloSysPro/commit/95efd43cc6e4098902feaa734c7bb2cd85e5aaff))
* **ui:** standardize management cards ([#20](https://github.com/chrystiamjr/VeloSysPro/issues/20)) ([2096a2e](https://github.com/chrystiamjr/VeloSysPro/commit/2096a2e94e475fab49e50661c005ffbb2f64d73d))

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

## [0.1.0] - 2026-07-23

### Added

- Initial release: React 18 + TypeScript + Vite + Tailwind UI hosted in a .NET 8 WPF
  app via Microsoft Edge WebView2, packaged as a single self-contained `VeloSysPro.exe`
  with the UI embedded as assembly resources.
- Quick/Full optimizations, Gaming Mode, Revert Defaults, registry backup & restore,
  and system restore point creation. Bilingual PT-BR/EN interface.
