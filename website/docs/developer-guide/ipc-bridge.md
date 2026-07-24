---
sidebar_position: 2
---

# IPC Bridge Communication

Communication between the React frontend and the C# host takes place via bi-directional JSON messaging over Edge WebView2.

## Bridge Infrastructure (`src/infrastructure/bridge.ts`) {#bridge-infrastructure-srcinfrastructurebridgets}

The frontend dispatches typed actions to C#:

```typescript
export function sendAction(action: string, payload?: Record<string, any>): void {
  if (window.chrome?.webview) {
    window.chrome.webview.postMessage(JSON.stringify({ action, ...payload }));
  }
}
```

## C# Event Dispatch (`desktop/MainWindow.xaml.cs`) {#c-event-dispatch-desktopmainwindowxamlcs}

The WPF host listens for WebView2 messages and routes them to `Optimizer` or host managers:

```csharp
private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
{
    var message = e.TryGetWebMessageAsString();
    // Dispatch action and emit progress/logs back to React
}
```

When an action finishes, C# emits `window.onActionFinished(action, ok)` to safely release the UI action lock.
