---
sidebar_position: 1
---

# Visão Geral da Arquitetura

O VeloSys Pro é um app desktop híbrido: uma interface **React 18 + TypeScript** roda dentro de um host **C# .NET 8 WPF** através do **Microsoft Edge WebView2**, entregue como um único `VeloSysPro.exe` autocontido.

:::tip Referência completa
Esta página é um mapa de alto nível. Para o design completo — a costura do `ActionHost`, o catálogo canônico de Events, todos os serviços C#, a ponte validada por Zod e as invariantes transversais — leia a [`ARCHITECTURE.md`](https://github.com/chrystiamjr/VeloSysPro/blob/main/ARCHITECTURE.md) na raiz, o vocabulário de domínio em [`CONTEXT.md`](https://github.com/chrystiamjr/VeloSysPro/blob/main/CONTEXT.md) e os [Architecture Decision Records](https://github.com/chrystiamjr/VeloSysPro/tree/main/docs/adr).
:::

## Pilha de Tecnologias

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS (Tokens de Design), Atomic Design, Zod, Vitest, Cypress.
- **Backend Host**: C# .NET 8 WPF, Microsoft Edge WebView2, APIs nativas do console do Windows (decodificação por code page OEM).
- **Empacotamento**: Executável único autocontido `VeloSysPro.exe` e um instalador Inno Setup.

## O modelo Action / Event {#modelo-action-event}

A comunicação é assimétrica e unidirecional por mensagem:

- **Actions** fluem da **UI → host** como `{ action, payload }`. Cada Action é validada e roteada pelo `ActionHost` em C#, que garante que apenas uma mutação rode por vez enquanto as leituras permanecem concorrentes.
- **Events** fluem do **host → UI** como envelopes `{ event, payload }` enviados com `PostWebMessageAsJson`. A UI tem um único listener `message`; o `bridge.ts` valida cada payload com Zod antes de despachá-lo.

```
+-------------------------------------------------------------+
|                      Interface React 18                     |
|  (Atomic Design: Atoms -> Molecules -> Organisms -> Pages)  |
+------------------------------+------------------------------+
        Action { action, payload } |  ^  Event { event, payload }
                                   v  |
+------------------------------+------------------------------+
|                   C# .NET 8 WPF Host                        |
|   ActionHost (valida / roteia / uma mutação por vez)        |
|   Optimizer, gerenciadores Backup/Restore/Scheduler/Settings|
|   CommandRunner (decode OEM), IpcEventEmitter               |
+------------------------------+------------------------------+
                               |
              APIs nativas do Windows / execução de processos
                               |
+------------------------------v------------------------------+
|            Windows OS (sfc, dism, netsh, WMI)               |
+-------------------------------------------------------------+
```

Veja [Comunicação Via Ponte IPC](./ipc-bridge.md) para o contrato concreto de `sendAction` / envelope de Event.
