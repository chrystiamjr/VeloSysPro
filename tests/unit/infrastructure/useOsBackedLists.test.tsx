import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppScreen } from '../../../src/domain/types';
import { emitHostEventForTest } from '../../../src/infrastructure/bridge';
import { useOsBackedLists } from '../../../src/infrastructure/useOsBackedLists';

const actions = () =>
  vi.mocked(window.chrome!.webview!.postMessage).mock.calls.map(([message]) => message.action);

describe('useOsBackedLists', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads only the lists relevant to the initial Dashboard', () => {
    renderHook(() => useOsBackedLists(AppScreen.Dashboard));

    expect(actions()).toEqual(['getBackups', 'getTasks']);
    expect(actions()).not.toContain('getRestorePoints');
  });

  it('refreshes the relevant list when the active screen changes', () => {
    const { rerender } = renderHook(({ screen }) => useOsBackedLists(screen), {
      initialProps: { screen: AppScreen.Dashboard },
    });
    vi.clearAllMocks();

    rerender({ screen: AppScreen.RestorePoints });

    expect(actions()).toEqual(['getRestorePoints']);
  });

  it('keeps host-emitted list state and exposes explicit refresh Actions', () => {
    const { result } = renderHook(() => useOsBackedLists(AppScreen.Backup));
    const backups = [
      {
        Name: 'backup.reg',
        CreatedAt: '2026-07-24T13:30:00.000Z',
        SizeBytes: 43520,
      },
    ];

    act(() => emitHostEventForTest('backupsLoaded', backups));
    expect(result.current.backups).toEqual(backups);

    vi.clearAllMocks();
    act(() => result.current.refreshBackups());
    expect(actions()).toEqual(['getBackups']);
  });
});
