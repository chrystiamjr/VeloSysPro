---
title: Freshness of OS-Backed Lists
keywords: refresh, refetch, stale, GET_TASKS, onActionFinished, action lock, empty state, Task Scheduler
---

# Freshness of OS-Backed Lists

## Overview

VeloSys Pro displays state that Windows owns: scheduled tasks, restore points, registry backups.
The app deliberately keeps **no sidecar index** (see
[0002-deterministic-naming-over-sidecar-index](../learning-records/0002-deterministic-naming-over-sidecar-index.md)),
so the Task Scheduler and the filesystem are the single source of truth. The trade-off is that
those sources can change **without the app knowing**: the user opens `taskschd.msc`, another tool
runs Disk Cleanup, System Protection prunes old points.

The C# host is purely reactive — it pushes a collection only when the frontend asks
(`GetTasks` → `PushTasks()`) or right after its own mutation. So freshness is entirely the
frontend's responsibility.

This was a real defect: `App.tsx` dispatched the `GET_*` actions **only on mount**, with no
polling, no refetch on navigation and none after a mutation. A task deleted in `taskschd.msc`
stayed on screen until the app restarted, which read as "the app keeps a stale copy" even though
the data is always read live.

## Strict Requirements

1. **Re-query on screen entry.** Every screen backed by OS state re-requests its own data set when
   opened, via a `useEffect` keyed on the active screen. Keep the map explicit and total, so adding
   a screen forces a decision rather than silently inheriting nothing.
2. **Exclude screens holding unsaved local edits.** Settings must *not* refetch: it would clobber
   pending changes with the last persisted values. An empty entry in the map is a decision, and
   should carry a comment saying so.
3. **Offer an explicit refresh too.** Navigation-based refetch does not help a user already on the
   screen who just changed something in Windows. Provide a visible control.
4. **Keep the refresh control usable in the empty state.** An empty list is precisely when
   re-querying matters — deleting the last task in Windows leaves no rows to hang a control off.
   Render the control outside the empty-state branch.
5. **Place it outside the horizontal scroll wrapper.** Tables keep `overflow-x-auto` with a stable
   `min-w` (see [responsive-management-layouts.md](./responsive-management-layouts.md)); a control
   inside that wrapper scrolls out of view on a narrow window.
6. **A refresh is a read: never take the action lock.** Dispatch through the plain action path, not
   the mutation path that sets `activeActionRef`. Do pass `disabled` so it cannot interleave with a
   mutation already in flight.
7. **Never hang a refetch on `onActionFinished`.** The host emits it from a `finally` for **every**
   action including the `GET_*` reads themselves (`MainWindow.xaml.cs`), so refetching there loops
   forever.

## Code & Architecture Examples

```typescript
// Requirement 1 & 2 — total map, with the exclusion justified in place.
const SCREEN_REFRESH_ACTIONS: Record<AppScreen, readonly string[]> = {
  [AppScreen.Dashboard]: [SystemActions.GET_BACKUPS, SystemActions.GET_TASKS],
  [AppScreen.Scheduling]: [SystemActions.GET_TASKS],
  [AppScreen.Backup]: [SystemActions.GET_BACKUPS],
  [AppScreen.RestorePoints]: [SystemActions.GET_RESTORE_POINTS],
  // Holds unsaved local edits; a refetch would clobber them.
  [AppScreen.Settings]: [],
};

useEffect(() => {
  for (const action of SCREEN_REFRESH_ACTIONS[activeScreen]) sendAction(action);
}, [activeScreen]);

// Requirement 6 — handleAction (no lock), not handleSystemMutation (takes the lock).
<SchedulingPage onRefresh={() => handleAction(SystemActions.GET_TASKS)} />
```

```typescript
// Requirements 4 & 5 — control above the scroller and outside the empty branch.
<div className="flex flex-col gap-3">
  {onRefresh && <div className="flex justify-end">{/* refresh Button */}</div>}
  <div data-cy={testId} className="overflow-x-auto rounded-xl border …">
    {rows.length === 0 ? <p>{emptyMessage}</p> : <table …/>}
  </div>
</div>
```

## Verification Commands

```bash
npm run validate
npx cypress run
```

Assert the **delta** in dispatched actions before/after navigating, never an absolute count —
`React.StrictMode` double-invokes effects in development. See
[falsifiable-test-guards.md](./falsifiable-test-guards.md).

Automated tests cannot cover the case that motivated this rule. Verify manually with elevation:
create a task, delete it in `taskschd.msc`, and confirm it disappears both on refresh and on
re-entering the screen.
