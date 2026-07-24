---
sidebar_position: 1
---

# Architecture Overview

VeloSys Pro is built on a high-performance hybrid architecture combining a C# .NET 8 desktop host with a React 18 TypeScript user interface.

## Tech Stack {#tech-stack}

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS (Design Tokens), Atomic Design, Vitest, Cypress.
- **Backend Host**: C# .NET 8 WPF, Microsoft Edge WebView2, Native Windows Console APIs (CP850 / OEM decoding).
- **Packaging**: Single self-contained `VeloSysPro.exe` and Inno Setup installer.

## System Diagram {#system-diagram}

```
+-------------------------------------------------------------+
|                      React 18 UI                            |
|  (Atomic Design Components: Atoms -> Molecules -> Pages)    |
+------------------------------+------------------------------+
                               |
                   WebView2 IPC (postMessage / JSON)
                               |
+------------------------------v------------------------------+
|                   C# .NET 8 WPF Host                        |
|  (MainWindow.xaml.cs, CommandRunner, NativeConsoleEncoding) |
+------------------------------+------------------------------+
                               |
                  Native Windows API / Process Execution
                               |
+------------------------------v------------------------------+
|            Windows OS (sfc, dism, netsh, WMI)               |
+-------------------------------------------------------------+
```
