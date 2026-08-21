import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';
import { useManagementAction } from '../../../src/infrastructure/useManagementAction';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe('useManagementAction', () => {
  it('executes callback when single confirmation is confirmed', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onConfirmed = vi.fn();

    const { result } = renderHook(() => useManagementAction(), { wrapper });

    act(() => {
      result.current.confirmAction('backup.restoreConfirm', onConfirmed);
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('does not execute callback when confirmation is denied', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onConfirmed = vi.fn();

    const { result } = renderHook(() => useManagementAction(), { wrapper });

    act(() => {
      result.current.confirmAction('backup.restoreConfirm', onConfirmed);
    });

    expect(onConfirmed).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('handles array of double confirmations', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onConfirmed = vi.fn();

    const { result } = renderHook(() => useManagementAction(), { wrapper });

    act(() => {
      result.current.confirmAction(['rp.restoreConfirm1', 'rp.restoreConfirm2'], onConfirmed);
    });

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });
});
