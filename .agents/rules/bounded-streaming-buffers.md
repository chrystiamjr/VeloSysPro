---
title: Bounded Streaming Buffers & IPC Event Windows
keywords: IPC, ring buffer, useLogBuffer, streaming, logs, stdout, memory safety, DOM performance, auto-expansion
---

# Bounded Streaming Buffers & IPC Event Windows

## Overview

Desktop applications with embedded WebViews frequently stream raw process stdout, stderr, and diagnostic facts across the IPC bridge. Commands like `sfc /scannow`, `dism /online /cleanup-image /restorehealth`, or verbose system dumps generate hundreds of log events per second.

Accumulating incoming log events in an unbounded React state array (`setLogs(prev => [...prev, item])`) leads to severe DOM thrashing, memory consumption leaks, and UI lag during lengthy background operations.

## Strict Requirements

1. **Always bound event arrays to a fixed capacity.** Implement a ring buffer (e.g., max 500 entries) in state hooks (`useLogBuffer`). When the buffer reaches capacity, trim the oldest entries from the top (`next.slice(next.length - capacity)`).
2. **Auto-expand viewports on actionable error events.** When an incoming log item carries `type === 'error'`, automatically expand the collapsible terminal/log console so failures are immediately visible to the user without manual navigation.
3. **Isolate log buffer mechanics from the root layout.** Encapsulate event subscription, array trimming, error expansion, and copy/clear helpers in a dedicated hook (`useLogBuffer`) instead of polluting root `App.tsx` state.
4. **Translate at render time, never at state accumulation time.** State should store locale-neutral message keys and dynamic arguments (`LogRecord { key, args, type }`). Translating at render time ensures logs dynamically update whenever the user switches the UI language.

## Code & Architecture Example

```typescript
// useLogBuffer.ts - Bounded ring buffer with auto-expansion on error
export function useLogBuffer(capacity = 500): LogBuffer {
  const [logs, setLogs] = useState<LogRecord[]>([{ key: 'log.appStarted', type: 'success' }]);
  const [consoleExpanded, setConsoleExpanded] = useState(false);

  useEffect(() => {
    return subscribeLogs((msg, type) => {
      setLogs((prev) => {
        const next = [...prev, { key: msg.key, args: msg.args, type }];
        return next.length > capacity ? next.slice(next.length - capacity) : next;
      });

      if (type === 'error') {
        setConsoleExpanded(true);
      }
    });
  }, [capacity]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, consoleExpanded, setConsoleExpanded, clearLogs };
}
```
