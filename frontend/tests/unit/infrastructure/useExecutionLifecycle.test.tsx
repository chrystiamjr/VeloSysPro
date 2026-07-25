import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitHostEventForTest } from '../../../src/infrastructure/bridge';
import { useExecutionLifecycle } from '../../../src/infrastructure/useExecutionLifecycle';

describe('useExecutionLifecycle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows reads without acquiring the mutation lock', () => {
    const { result } = renderHook(() => useExecutionLifecycle());

    act(() => result.current.runRead('getTasks'));

    expect(result.current.activeAction).toBeNull();
    expect(window.chrome?.webview?.postMessage).toHaveBeenCalledWith({
      action: 'getTasks',
      payload: null,
    });
  });

  it('blocks overlapping mutations until matching authoritative completion', () => {
    const { result } = renderHook(() => useExecutionLifecycle());

    act(() => {
      expect(result.current.runMutation('createTask', '{}')).toBe(true);
      expect(result.current.runMutation('deleteTask', 'task')).toBe(false);
    });
    expect(result.current.activeAction).toBe('createTask');

    act(() => emitHostEventForTest('progressUpdated', 100));
    expect(result.current.activeAction).toBe('createTask');

    act(() =>
      emitHostEventForTest('actionFinished', { action: 'deleteTask', ok: true })
    );
    expect(result.current.activeAction).toBe('createTask');

    act(() =>
      emitHostEventForTest('actionFinished', { action: 'createTask', ok: true })
    );
    expect(result.current.activeAction).toBeNull();
  });

  it('uses the completion result as the authoritative failure state', () => {
    const { result } = renderHook(() => useExecutionLifecycle());

    act(() => {
      result.current.runMutation('createTask');
      emitHostEventForTest('actionFinished', { action: 'createTask', ok: false });
    });

    expect(result.current.activeAction).toBeNull();
    expect(result.current.executionHasError).toBe(true);
  });
});
