---
sidebar_position: 2
---

# Comunicação Via Ponte IPC

A comunicação entre o frontend React e o host C# ocorre sobre o Edge WebView2 usando dois formatos de mensagem distintos e unidirecionais: **Actions** (UI → host) e **envelopes de Event** (host → UI). A costura no frontend fica em `frontend/src/infrastructure/bridge.ts`.

## Enviando Actions (UI → host) {#enviando-actions}

A UI envia uma mensagem `{ action, payload }`. O `ActionHost` em C# valida e roteia — as leituras rodam concorrentemente, enquanto as mutações são serializadas uma por vez.

```typescript
export function sendAction(action: string, payload?: unknown): void {
  window.chrome?.webview?.postMessage({ action, payload });
}
```

## Recebendo Events (host → UI) {#recebendo-events}

O host emite envelopes `{ event, payload }` com `PostWebMessageAsJson`. A ponte anexa um **único** listener `message` e valida cada envelope com um schema **Zod** antes de despachá-lo aos assinantes — um payload inválido é rejeitado em vez de chegar ao estado do React.

```typescript
webview.addEventListener('message', (e) => {
  const envelope = IpcEventEnvelopeSchema.parse(e.data); // { event, payload }
  dispatchHostEvent(envelope);
});
```

Nomes canônicos de Event incluem `logReceived`, `statusUpdated`, `progressUpdated`, `backupsLoaded`, `tasksLoaded`, `restorePointsLoaded`, `settingsLoaded`, `updateAvailable` e `actionFinished`.

## O ciclo de vida da ação {#ciclo-de-vida-da-acao}

Toda mutação adquire uma trava de execução no momento em que sua Action é enviada. A trava é liberada de forma **autoritativa** pelo Event `actionFinished` correspondente, que o host emite dentro de um bloco `finally` — então a UI destrava de forma confiável mesmo quando o comando falha. Leituras nunca adquirem a trava. Veja `useExecutionLifecycle.ts` para o hook que controla isso.

```csharp
// desktop/Ipc/ActionHost.cs — emitido em um finally, ok reflete o sucesso real
_events.Emit(IpcEvents.ActionFinished, new { action, ok });
```
