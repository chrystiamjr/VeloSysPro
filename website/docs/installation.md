---
sidebar_position: 2
---

# Installation & Usage

## Downloading VeloSys Pro {#downloading-velosys-pro}

You can download the latest version from the [GitHub Releases](https://github.com/chrystiamjr/VeloSysPro/releases) page.

We provide two formats:
1. **`VeloSysPro-Setup-<version>.exe` (Recommended)**: An Inno Setup installer that sets up Start Menu shortcuts and automatically installs the Microsoft WebView2 Runtime if missing.
2. **`VeloSysPro.exe`**: A portable, single-file executable that requires no installation.

## Running the Application {#running-the-application}

1. Double-click **`VeloSysPro.exe`** or the installed shortcut.
2. Accept the **User Account Control (UAC)** prompt. Administrator privileges are necessary to execute system-level commands (`sfc`, `dism`, `netsh`, and System Restore calls).

:::note SmartScreen Warning
VeloSys Pro is not code-signed yet, so Windows SmartScreen may display *"Windows protected your PC"* for downloads from an unknown publisher. Click **More info → Run anyway** to proceed.
:::
