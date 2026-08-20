---
title: Report an Outcome Where the Action Was Taken
keywords: actionFinished, toast, log panel, notification, mutation filter, feedback, screen, outcome
---

# Report an Outcome Where the Action Was Taken

## Overview

`TerminalConsole` is rendered only by `DashboardPage`. For a long time that was the app's *only* outcome surface, so a failure raised from Optimize, Backup, Scheduling or Restore Points was announced on a screen the user was not looking at. Reaching it meant leaving the work; not reaching it meant a failure passed for a success.

A shared log panel is a **trail** — valuable for reconstructing what happened. It is not a **notification**, and it cannot carry the weight of one. The two are different jobs and need different surfaces.

The host already emits everything needed: `ActionHost` publishes an authoritative `actionFinished` (`{ action, ok }`) for every Action, and `IStatusSink` publishes each log line as a translatable `{ key, args }`. Reporting an outcome is therefore a matter of consuming what exists, not extending the IPC contract.

## Strict Requirements

1. **Every mutation reports its outcome on the screen that started it.** Success and failure alike, without navigation.
2. **Announce only mutations started locally.** The host reports *every* Action, reads included; without a filter each list refresh raises a notice. Match the outcome against the action this client dispatched — the same `activeAction` match that already keeps reads out of the execution lock.
3. **Carry the host's reason, not a re-invented one.** `actionFinished` has no reason field; pair it with the last log of matching severity so the report quotes the host's own translatable key. Do **not** write a per-Action heading vocabulary — it would drift out of step with the log until the two contradict each other.
4. **A raw host line is text, not a key.** `log.raw` must bypass `t()`, exactly as the log panel does.
5. **A success may dismiss itself; a failure may not.** Being missable is the defect this surface exists to fix. Give a failure an explicit path to the full trail.
6. **A floating surface must not cover the controls it reports on.** The action bar owns the bottom edge of the content panel. Prove the non-overlap by **measuring in Cypress**, never by reading the markup — see `tailwind-layout-invariants.md`.

## Code & Architecture Examples

```ts
// The mutation filter is what keeps this surface from becoming noise.
subscribeActionFinished((action, ok) => {
  // The host reports every Action, reads included.
  if (action !== activeActionRef.current) return;
  setLastOutcome((previous) => ({ seq: (previous?.seq ?? 0) + 1, action, ok }));
});
```

```ts
// Identity of an outcome is the run, not its contents: two identical failures are
// two reports. Key on a monotonic seq, never on a value-compared object.
useEffect(() => { /* push a report */ }, [lastOutcome?.seq]);
```

```tsx
// A failure interrupts a screen reader; a success waits its turn.
<div role={ok ? 'status' : 'alert'}>
```

## Verification Commands

```bash
npm run test        # unit: mutation filter, reason pairing, failure persistence
npm run cypress:run # e2e: reported off-Dashboard, silent for reads, clears the action bar
```

## Related

- `os-backed-list-freshness.md` — the refresh half of the same seam.
- `tailwind-layout-invariants.md` — why the non-overlap is measured.
- `fullstack-sync.md` — why the reason was recovered from the log stream instead of widening the Event payload.
