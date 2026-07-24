---
sidebar_position: 1
---

# Visão Geral da Arquitetura

O VeloSys Pro é construído sobre uma arquitetura híbrida de alta performance combinando um host desktop C# .NET 8 com uma interface de usuário React 18 TypeScript.

## Pilha de Tecnologias

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS (Tokens de Design), Atomic Design, Vitest, Cypress.
- **Backend Host**: C# .NET 8 WPF, Microsoft Edge WebView2, APIs Nativas do Console do Windows (decodificação CP850 / OEM).
- **Empacotamento**: Executável único autocontido `VeloSysPro.exe` e instalador Inno Setup.

## Diagrama do Sistema

```
+-------------------------------------------------------------+
|                      Interface React 18                     |
|  (Componentes Atomic Design: Atoms -> Molecules -> Pages)   |
+------------------------------+------------------------------+
                               |
                   IPC WebView2 (postMessage / JSON)
                               |
+------------------------------v------------------------------+
|                   C# .NET 8 WPF Host                        |
|  (MainWindow.xaml.cs, CommandRunner, NativeConsoleEncoding) |
+------------------------------+------------------------------+
                               |
              Execução de Processos / APIs do Windows
                               |
+------------------------------v------------------------------+
|            Windows OS (sfc, dism, netsh, WMI)               |
+-------------------------------------------------------------+
```
