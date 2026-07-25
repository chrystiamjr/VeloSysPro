---
sidebar_position: 2
---

# IPC Bridge Communication

Communication between the React frontend and the C# host runs over Edge WebView2 using two distinct, one-directional message shapes: **Actions** (UI → host) and **Event envelopes** (host → UI). The frontend seam lives in `src/infrastructure/bridge.ts`.

## Sending Actions (UI → host) {#sending-actions}

The UI posts an `{ action, payload }` message. The C# `ActionHost` validates and routes it — reads run concurrently, while mutations are serialized one at a time.

```typescript
export function sendAction(action: string, payload?: unknown): void {
  window.chrome?.webview?.postMessage({ action, payload });
}
```

## Receiving Events (host → UI) {#receiving-events}

The host emits `{ event, payload }` envelopes with `PostWebMessageAsJson`. The bridge attaches a **single** `message` listener, then validates each envelope with a **Zod** schema before dispatching it to subscribers — an invalid payload is rejected instead of reaching React state.

```typescript
webview.addEventListener('message', (e) => {
  const envelope = IpcEventEnvelopeSchema.parse(e.data); // { event, payload }
  dispatchHostEvent(envelope);
});
```

Canonical Event names include `logReceived`, `statusUpdated`, `progressUpdated`, `backupsLoaded`, `tasksLoaded`, `restorePointsLoaded`, `settingsLoaded`, `updateAvailable`, and `actionFinished`.

## The action lifecycle {#action-lifecycle}

Every mutation acquires an execution lock the moment its Action is sent. The lock is released **authoritatively** by the matching `actionFinished` Event, which the host emits from a `finally` block — so the UI unlocks reliably even when the command fails. Reads never take the lock. See `useExecutionLifecycle.ts` for the hook that owns this.

```csharp
// desktop/ActionHost.cs — emitted in a finally, ok reflects real success
_events.Emit(IpcEvents.ActionFinished, new { action, ok });
```
