import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsPage } from '../../../src/components/pages/SettingsPage';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const renderPage = (props: Partial<React.ComponentProps<typeof SettingsPage>> = {}) => {
  const merged = {
    language: 'pt_BR' as const,
    createBackupBeforeOptimize: true,
    onLanguageChange: vi.fn(),
    onToggleBackup: vi.fn(),
    ...props,
  };
  render(
    <LanguageProvider>
      <SettingsPage {...merged} />
    </LanguageProvider>
  );
  return merged;
};

describe('SettingsPage', () => {
  it('changes language when the English button is clicked', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /English/i }));
    expect(props.onLanguageChange).toHaveBeenCalledWith('en_US');
  });

  it('toggles the safety-backup preference', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onToggleBackup).toHaveBeenCalledWith(false);
  });

  it('reflects the disabled state', () => {
    renderPage({ createBackupBeforeOptimize: false });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});
