---
sidebar_position: 2
---

# Comunicação Via Ponte IPC

A comunicação entre o frontend React e o host C# ocorre através de mensagens JSON bidirecionais sobre o Edge WebView2.

## Infraestrutura da Ponte (`src/infrastructure/bridge.ts`)

O frontend envia ações tipadas para o C#:

```typescript
export function sendAction(action: string, payload?: Record<string, any>): void {
  if (window.chrome?.webview) {
    window.chrome.webview.postMessage(JSON.stringify({ action, ...payload }));
  }
}
```

## Roteamento de Eventos no C# (`desktop/MainWindow.xaml.cs`)

O host WPF escuta as mensagens do WebView2 e as encaminha para o `Optimizer` ou gerenciadores do sistema:

```csharp
private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
{
    var message = e.TryGetWebMessageAsString();
    // Encaminha a ação e envia o progresso/logs de volta ao React
}
```

Quando uma ação é concluída, o C# emite o evento `window.onActionFinished(action, ok)` para liberar com segurança a trava de interface.
