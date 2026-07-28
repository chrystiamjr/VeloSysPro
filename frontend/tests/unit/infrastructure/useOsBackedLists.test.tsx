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

  it('re-queries the Tweak catalog and the history when Optimize is opened', () => {
    // The history is what puts the last comparison back on screen after the app is reopened.
    const { rerender } = renderHook(({ screen }) => useOsBackedLists(screen), {
      initialProps: { screen: AppScreen.Dashboard },
    });
    vi.clearAllMocks();

    rerender({ screen: AppScreen.Optimize });

    expect(actions()).toEqual(['loadTweaks', 'loadHistory']);
  });

  it('keeps the persisted Snapshot series the host reports', () => {
    const { result } = renderHook(() => useOsBackedLists(AppScreen.Optimize));
    const snapshot = {
      capturedAt: '2026-07-25T10:00:00.000Z',
      bootDurationMs: 21345,
      freeMemoryBytes: 8589934592,
      totalMemoryBytes: 17179869184,
      freeDiskBytes: 120000000000,
      totalDiskBytes: 500000000000,
      automaticServices: 94,
      runningServices: 71,
      startupApps: 13,
      pendingReboot: false,
      lastBootUpTime: '2026-07-25T08:00:00.000Z',
    };

    act(() => emitHostEventForTest('historyLoaded', [snapshot, snapshot]));
    expect(result.current.history).toHaveLength(2);

    act(() => emitHostEventForTest('historyLoaded', [{ capturedAt: 'nope' }]));
    expect(result.current.history).toHaveLength(2);
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
          recommended: false,
          requiresReboot: false,
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
