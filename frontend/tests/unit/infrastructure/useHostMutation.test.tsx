import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emitHostEventForTest } from '../../../src/infrastructure/bridge';
import { useHostMutation } from '../../../src/infrastructure/useHostMutation';

describe('useHostMutation', () => {
  it('acquires the execution lock and tracks progress during mutation', () => {
    const { result } = renderHook(() => useHostMutation());

    expect(result.current.activeAction).toBeNull();
    expect(result.current.progressPercent).toBe(100);

    let started = false;
    act(() => {
      started = result.current.runMutation('applyPreset', { id: 'gaming' });
    });

    expect(started).toBe(true);
    expect(result.current.activeAction).toBe('applyPreset');

    // A concurrent mutation is rejected while activeAction is held
    act(() => {
      const second = result.current.runMutation('createManualBackup');
      expect(second).toBe(false);
    });

    act(() => {
      emitHostEventForTest('progressUpdated', 45);
    });
    expect(result.current.progressPercent).toBe(45);

    act(() => {
      emitHostEventForTest('logReceived', {
        message: { key: 'log.preset.applied' },
        type: 'success',
      });
      emitHostEventForTest('actionFinished', { action: 'applyPreset', ok: true });
    });

    expect(result.current.activeAction).toBeNull();
    expect(result.current.executionHasError).toBe(false);
    expect(result.current.feedbackItems).toHaveLength(1);
    expect(result.current.feedbackItems[0].ok).toBe(true);
    expect(result.current.feedbackItems[0].detail?.key).toBe('log.preset.applied');
  });

  it('captures failure reason and allows dismissing feedback item', () => {
    const { result } = renderHook(() => useHostMutation());

    act(() => {
      result.current.runMutation('createRestorePoint');
    });

    act(() => {
      emitHostEventForTest('logReceived', {
        message: { key: 'log.restorePoint.unconfirmed' },
        type: 'error',
      });
      emitHostEventForTest('actionFinished', { action: 'createRestorePoint', ok: false });
    });

    expect(result.current.executionHasError).toBe(true);
    expect(result.current.feedbackItems).toHaveLength(1);
    expect(result.current.feedbackItems[0].ok).toBe(false);
    expect(result.current.feedbackItems[0].detail?.key).toBe('log.restorePoint.unconfirmed');

    const { id } = result.current.feedbackItems[0];
    act(() => {
      result.current.dismissFeedback(id);
    });

    expect(result.current.feedbackItems).toHaveLength(0);
  });
});
