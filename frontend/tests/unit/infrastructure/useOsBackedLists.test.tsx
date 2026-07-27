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

  it('re-queries the Tweak catalog when the Optimize screen is opened', () => {
    const { rerender } = renderHook(({ screen }) => useOsBackedLists(screen), {
      initialProps: { screen: AppScreen.Dashboard },
    });
    vi.clearAllMocks();

    rerender({ screen: AppScreen.Optimize });

    expect(actions()).toEqual(['loadTweaks']);
  });

  it('keeps the last valid Tweak catalog when the host emits a broken one', () => {
    const { result } = renderHook(() => useOsBackedLists(AppScreen.Optimize));
    const catalog = {
      tweaks: [
        {
          id: 'cpu.win32PrioritySeparation',
          category: 'cpu',
          riskTier: 'Safe' as const,
          kind: 'registry' as const,
          state: 'Applied' as const,
        },
      ],
      presets: [{ id: 'quick', tweakIds: ['cpu.win32PrioritySeparation'] }],
      systemProtectionEnabled: true,
    };

    act(() => emitHostEventForTest('tweaksLoaded', catalog));
    expect(result.current.tweakCatalog).toEqual(catalog);

    act(() => emitHostEventForTest('tweaksLoaded', {
        tweaks: [{ id: 'broken' }],
        presets: [],
        systemProtectionEnabled: true,
      }));
    expect(result.current.tweakCatalog).toEqual(catalog);

    vi.clearAllMocks();
    act(() => result.current.refreshTweaks());
    expect(actions()).toEqual(['loadTweaks']);
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
