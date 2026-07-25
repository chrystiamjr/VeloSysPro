---
sidebar_position: 1
---

# Architecture Overview

VeloSys Pro is a hybrid desktop app: a **React 18 + TypeScript** UI runs inside a **C# .NET 8 WPF** host through **Microsoft Edge WebView2**, shipped as a single self-contained `VeloSysPro.exe`.

:::tip Full reference
This page is a high-level map. For the complete design — the `ActionHost` seam, the canonical Event catalog, every C# service, the Zod-validated bridge, and cross-cutting invariants — read the root [`ARCHITECTURE.md`](https://github.com/chrystiamjr/VeloSysPro/blob/main/ARCHITECTURE.md), the domain vocabulary in [`CONTEXT.md`](https://github.com/chrystiamjr/VeloSysPro/blob/main/CONTEXT.md), and the [Architecture Decision Records](https://github.com/chrystiamjr/VeloSysPro/tree/main/docs/adr).
:::

## Tech Stack {#tech-stack}

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS (Design Tokens), Atomic Design, Zod, Vitest, Cypress.
- **Backend Host**: C# .NET 8 WPF, Microsoft Edge WebView2, native Windows console APIs (OEM code-page decoding).
- **Packaging**: Single self-contained `VeloSysPro.exe` plus an Inno Setup installer.

## The Action / Event model {#action-event-model}

Communication is asymmetric and one-directional per message:

- **Actions** flow **UI → host** as `{ action, payload }`. Every Action is validated and routed by the C# `ActionHost`, which enforces that only one mutation runs at a time while reads stay concurrent.
- **Events** flow **host → UI** as `{ event, payload }` envelopes sent with `PostWebMessageAsJson`. The UI has a single `message` listener; `bridge.ts` validates each payload with Zod before dispatching it.

```
+-------------------------------------------------------------+
|                      React 18 UI                            |
|  (Atomic Design: Atoms -> Molecules -> Organisms -> Pages)  |
+------------------------------+------------------------------+
        Action { action, payload } |  ^  Event { event, payload }
                                   v  |
+------------------------------+------------------------------+
|                   C# .NET 8 WPF Host                        |
|   ActionHost (validate / route / one-mutation-at-a-time)    |
|   Optimizer, Backup/Restore/Scheduler/Settings managers,    |
|   CommandRunner (OEM decode), IpcEventEmitter               |
+------------------------------+------------------------------+
                               |
              Native Windows API / process execution
                               |
+------------------------------v------------------------------+
|            Windows OS (sfc, dism, netsh, WMI)               |
+-------------------------------------------------------------+
```

See [IPC Bridge Communication](./ipc-bridge.md) for the concrete `sendAction` / Event-envelope contract.
