import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emitHostEventForTest } from '../../../src/infrastructure/bridge';
import { useLogBuffer } from '../../../src/infrastructure/useLogBuffer';

describe('useLogBuffer', () => {
  it('appends incoming logs and auto-expands console on error', () => {
    const { result } = renderHook(() => useLogBuffer());

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.consoleExpanded).toBe(false);

    act(() => {
      emitHostEventForTest('logReceived', {
        message: { key: 'log.quick.start' },
        type: 'info',
      });
    });

    expect(result.current.logs).toHaveLength(2);
    expect(result.current.consoleExpanded).toBe(false);

    act(() => {
      emitHostEventForTest('logReceived', {
        message: { key: 'log.cmdError', args: { exe: 'sfc.exe' } },
        type: 'error',
      });
    });

    expect(result.current.logs).toHaveLength(3);
    expect(result.current.consoleExpanded).toBe(true);
  });

  it('respects capacity limit as a ring buffer', () => {
    const { result } = renderHook(() => useLogBuffer(3));

    act(() => {
      emitHostEventForTest('logReceived', { message: { key: 'log.1' }, type: 'info' });
      emitHostEventForTest('logReceived', { message: { key: 'log.2' }, type: 'info' });
      emitHostEventForTest('logReceived', { message: { key: 'log.3' }, type: 'info' });
      emitHostEventForTest('logReceived', { message: { key: 'log.4' }, type: 'info' });
    });

    expect(result.current.logs).toHaveLength(3);
    expect(result.current.logs.map((l) => l.key)).toEqual(['log.2', 'log.3', 'log.4']);
  });

  it('clears log buffer on clearLogs()', () => {
    const { result } = renderHook(() => useLogBuffer());

    act(() => {
      emitHostEventForTest('logReceived', { message: { key: 'log.item' }, type: 'info' });
    });
    expect(result.current.logs.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearLogs();
    });
    expect(result.current.logs).toHaveLength(0);
  });
});
