# Action Registry and Type-Safe IPC Contract

IPC actions are routed through an authoritative `ActionRegistry` on the C# host and enforced with mapped generic contracts `sendAction<A>(action, payload)` in TypeScript.

## Considered Options

- Unchecked string-based action dispatching in `ActionHost.cs` and `bridge.ts`.
- RPC request/response promises over WebView2 messages.
- Authoritative Action Registry on host with discriminated union TypeScript action-payload map on frontend.

## Consequences

- `ActionHost` focuses strictly on concurrency control, thread-pool dispatch, diagnostic logging, and action outcome event emission.
- Payload parsing (`JsonElement` deserialization) and mutation registration live in `ActionRegistry`.
- Frontend compile-time autocompletion and type checking for all action call sites, eliminating runtime action name and payload typos.
