import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitHostEventForTest } from '../../../src/infrastructure/bridge';
import { usePreferences } from '../../../src/infrastructure/usePreferences';

describe('usePreferences', () => {
  afterEach(() => vi.clearAllMocks());

  it('hydrates preferences and synchronizes language through one interface', () => {
    const applyLanguage = vi.fn();
    const { result } = renderHook(() => usePreferences(applyLanguage));
    const loaded = {
      language: 'en_US' as const,
      createBackupBeforeOptimize: false,
      sidebarCollapsed: true,
    };

    act(() => emitHostEventForTest('settingsLoaded', loaded));

    expect(result.current.settings).toEqual(loaded);
    expect(applyLanguage).toHaveBeenCalledWith('en_US');
  });

  it('applies and persists a complete optimistic update', () => {
    const { result } = renderHook(() => usePreferences(vi.fn()));
    act(() =>
      emitHostEventForTest('settingsLoaded', {
        language: 'pt_BR',
        createBackupBeforeOptimize: true,
        sidebarCollapsed: false,
      })
    );
    vi.clearAllMocks();

    act(() => result.current.setSafetyBackup(false));

    expect(result.current.settings.createBackupBeforeOptimize).toBe(false);
    expect(window.chrome?.webview?.postMessage).toHaveBeenCalledWith({
      action: 'saveSettings',
      payload: {
        language: 'pt_BR',
        createBackupBeforeOptimize: false,
        sidebarCollapsed: false,
      },
    });
  });
});
