# Use WebView2 Event Envelopes

The Windows host will emit structured `{ event, payload }` envelopes through WebView2 web messaging, and the React frontend will receive them through one message listener. This replaces global JavaScript callbacks executed as strings because a single native channel concentrates serialization and validation policy, removes an unused legacy transport, and gives host-to-frontend Events one explicit seam.

## Considered Options

- Global callback functions invoked through `ExecuteScriptAsync`.
- Structured Events sent through `PostWebMessageAsJson`.

## Consequences

React-to-host intentions remain Actions sent with `window.chrome.webview.postMessage`. Host-to-React facts are Events; unknown or invalid Events are diagnosed and ignored without clearing the last valid state.
