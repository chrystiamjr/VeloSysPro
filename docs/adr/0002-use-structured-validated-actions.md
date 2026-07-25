# Use Structured, Host-Validated Actions

React-to-host Actions will carry structured payloads that the Action host validates before invoking Windows behavior. The host also enforces one mutating Action at a time while allowing concurrent reads, because elevated-operation safety must not depend solely on the React interface.

## Considered Options

- Preserve string payloads and validate inside individual modules.
- Use structured payloads and validate once at the Action seam.

## Consequences

React and the Windows host migrate atomically as one executable, so legacy string payload compatibility is not retained. Invalid or overlapping mutating Actions finish with `ok: false`, and successful mutations alone trigger refreshed Management Records.
