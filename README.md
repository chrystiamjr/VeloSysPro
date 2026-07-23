# ⚡ VeloSys Pro

> High-performance Windows Optimization, Maintenance, and System Recovery Suite by **Envolvo Systems LTDA.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg)]()
[![Build](https://img.shields.io/badge/Build-C%23%20%2B%20React%2018%20%2B%20TypeScript-0078D6.svg)]()

---

## 📌 Features

- 🚀 **Quick Optimization**: Flushes DNS cache, cleans temporary files, and performs lightweight system maintenance.
- ⚙️ **Full Optimization**: Runs System File Checker (`sfc /scannow`), DISM image repair, disk check, and deep temp cleanup.
- 🎮 **Gaming Mode**: Tunes TCP network stack parameters (`RSS`, `Autotuning`) for low latency and online gaming.
- ↺ **Revert Defaults**: Resets IP and Winsock network configurations back to factory defaults.
- 🛡️ **System Restore Points**: Creates verified Windows System Restore Points prior to major changes.
- 💾 **Registry Backup & Recovery**: Exports safety backups of TCP/IP parameters to `.reg` files.
- 🌐 **Bilingual i18n (Rosetta)**: Instant language switching between **Português (pt_BR)** 🇧🇷 and **English (en_US)** 🇺🇸.
- 🎨 **Modern Dark UI**: Componentized with **React 18 + TypeScript + TailwindCSS Design System Tokens** using **Atomic Design**.

---

## 🏗️ Architecture

```
Windows Optimizer/
├── AGENTS.md                  # Project rules & coding standards in English
├── README.md                  # Main repository documentation
├── LICENSE                    # MIT License (Envolvo Systems LTDA.)
├── .gitignore                 # Clean repository file filters
├── .editorconfig              # Shared indentation & charset settings
├── global.json                # Pins the .NET 8 SDK for the build
├── package.json               # React, Vite, Tailwind, Vitest, Cypress, Rosetta
├── tsconfig.json              # Strict TypeScript configuration
├── vite.config.js             # Vite build config (outputs ui/)
├── src/
│   ├── domain/                # Interfaces & Rosetta i18n (pt_BR.json, en_US.json)
│   ├── infrastructure/        # Typed IPC bridge (bridge.ts)
│   └── components/            # Atomic Design (atoms, molecules, organisms, templates, pages)
├── tests/
│   ├── unit/                  # Vitest unit test suite
│   └── e2e/                   # Cypress E2E test specs
├── desktop/                   # C# .NET 8 WPF host (Edge Chromium WebView2)
│   ├── App.xaml(.cs)          # WPF application entry point
│   ├── MainWindow.xaml(.cs)   # WebView2 host + IPC bridge
│   ├── IpcHandler.cs          # System.Text.Json IPC parser
│   ├── CommandRunner.cs       # System command execution
│   ├── BackupManager.cs       # Registry backups & restore points
│   ├── ManagedStream.cs       # Embedded-asset stream wrapper
│   ├── app.manifest           # UAC Manifest (requireAdministrator)
│   └── VeloSysPro.csproj      # Single-file publish (ui/ embedded)
└── build.ps1                  # 1-Click native build script
```

---

## 🚀 Getting Started

### For End Users
1. Download **`VeloSysPro.exe`** from the latest release.
2. Double-click **`VeloSysPro.exe`** and grant Administrator privileges when prompted by Windows UAC.

### For Developers
1. Clone the repository:
   ```bash
   git clone https://github.com/EnvolvoSystems/VeloSysPro.git
   cd VeloSysPro
   ```
2. Build the native executable:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\build.ps1
   ```
