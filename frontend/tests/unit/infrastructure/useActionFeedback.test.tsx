import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emitHostEventForTest } from '../../../src/infrastructure/bridge';
import { useActionFeedback } from '../../../src/infrastructure/useActionFeedback';
import { useExecutionLifecycle } from '../../../src/infrastructure/useExecutionLifecycle';

/** Drives the two hooks together, which is how App composes them. */
const renderFeedback = () =>
  renderHook(() => {
    const lifecycle = useExecutionLifecycle();
    const feedback = useActionFeedback(lifecycle.activeAction, lifecycle.lastOutcome);
    return { lifecycle, feedback };
  });

describe('useActionFeedback', () => {
  it('reports a failure with the reason the host logged for it', () => {
    const { result } = renderFeedback();

    act(() => {
      result.current.lifecycle.runMutation('createRestorePoint');
    });
    act(() => {
      emitHostEventForTest('logReceived', {
        message: { key: 'log.restorePoint.unconfirmed' },
        type: 'error',
      });
      emitHostEventForTest('actionFinished', { action: 'createRestorePoint', ok: false });
    });

    const item = result.current.feedback.items[0];
    expect(item.ok).toBe(false);
    expect(item.action).toBe('createRestorePoint');
    expect(item.detail?.key).toBe('log.restorePoint.unconfirmed');
  });

  it('stays silent for the reads the host reports alongside mutations', () => {
    const { result } = renderFeedback();

    act(() => {
      emitHostEventForTest('actionFinished', { action: 'getRestorePoints', ok: true });
      emitHostEventForTest('actionFinished', { action: 'getBackups', ok: true });
    });

    expect(result.current.feedback.items).toHaveLength(0);
  });

  it('does not explain one run with the previous run’s words', () => {
    const { result } = renderFeedback();

    act(() => result.current.lifecycle.runMutation('createRestorePoint'));
    act(() => {
      emitHostEventForTest('logReceived', {
        message: { key: 'log.restorePoint.unconfirmed' },
        type: 'error',
      });
      emitHostEventForTest('actionFinished', { action: 'createRestorePoint', ok: false });
    });

    // A second run that fails without saying anything must not inherit the first one's reason.
    act(() => result.current.lifecycle.runMutation('createRestorePoint'));
    act(() =>
      emitHostEventForTest('actionFinished', { action: 'createRestorePoint', ok: false })
    );

    expect(result.current.feedback.items).toHaveLength(2);
    expect(result.current.feedback.items[1].detail).toBeNull();
  });

  it('keeps two identical outcomes as two separate reports', () => {
    const { result } = renderFeedback();

    for (let run = 0; run < 2; run += 1) {
      act(() => result.current.lifecycle.runMutation('createManualBackup'));
      act(() =>
        emitHostEventForTest('actionFinished', { action: 'createManualBackup', ok: true })
      );
    }

    expect(result.current.feedback.items).toHaveLength(2);
    expect(result.current.feedback.items[0].id).not.toBe(result.current.feedback.items[1].id);
  });

  it('drops a report once it is dismissed', () => {
    const { result } = renderFeedback();

    act(() => result.current.lifecycle.runMutation('applyTweaks'));
    act(() => emitHostEventForTest('actionFinished', { action: 'applyTweaks', ok: false }));

    const { id } = result.current.feedback.items[0];
    act(() => result.current.feedback.dismiss(id));

    expect(result.current.feedback.items).toHaveLength(0);
  });
});
