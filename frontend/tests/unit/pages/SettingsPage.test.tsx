import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsPage } from '../../../src/components/pages/SettingsPage';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';
import packageJson from '../../../package.json';

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

  it('always shows the installed version', () => {
    renderPage();
    // Exact matching keeps the assertion off the wrapper elements, whose combined
    // textContent contains both the label and the value.
    expect(screen.getByText('Versão instalada')).toBeInTheDocument();
    expect(
      screen.getByText(`Versão ${packageJson.version} (Build C# / React)`)
    ).toBeInTheDocument();
  });

  it('reports being up to date when the host announced no update', () => {
    renderPage();
    expect(screen.getByText(/Você está na versão mais recente/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Baixar/i })).not.toBeInTheDocument();
  });

  it('offers the download for a pending update', () => {
    const props = renderPage({
      updateInfo: { version: '0.9.0', url: 'https://example.test/v0.9.0' },
      onDownloadUpdate: vi.fn(),
    });

    expect(screen.getByText(/Nova versão 0\.9\.0 disponível/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Baixar/i }));
    expect(props.onDownloadUpdate).toHaveBeenCalledWith('https://example.test/v0.9.0');
  });

  it('renders the update heading before its full-width action', () => {
    renderPage({ updateInfo: { version: '0.9.0', url: 'https://example.test/v0.9.0' } });
    const heading = screen.getByRole('heading', { name: /Atualizações/i });
    const button = screen.getByRole('button', { name: /Baixar/i });

    expect(button.parentElement).toHaveClass('flex-col', 'gap-5');
    expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
