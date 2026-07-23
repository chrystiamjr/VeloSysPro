import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BackupPage } from '../../../src/components/pages/BackupPage';
import { BackupItem } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const backups: BackupItem[] = [
  { Name: 'backup_rede_2026-07-23_03-15-12.reg', Date: '23/07/2026 03:15', Size: '39.0 KB' },
];

const renderPage = (props: Partial<React.ComponentProps<typeof BackupPage>> = {}) => {
  const merged = {
    backups,
    onCreateBackup: vi.fn(),
    onRestoreBackup: vi.fn(),
    onOpenFolder: vi.fn(),
    ...props,
  };
  render(
    <LanguageProvider>
      <BackupPage {...merged} />
    </LanguageProvider>
  );
  return merged;
};

describe('BackupPage (functional Backup & Restore screen)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists existing backups from the IPC data', () => {
    renderPage();
    expect(screen.getByText('backup_rede_2026-07-23_03-15-12.reg')).toBeInTheDocument();
    expect(screen.getByText('39.0 KB')).toBeInTheDocument();
  });

  it('shows an empty state when there are no backups', () => {
    renderPage({ backups: [] });
    expect(screen.getByText(/Nenhum backup encontrado/i)).toBeInTheDocument();
  });

  it('triggers onCreateBackup when the create button is clicked', () => {
    const props = renderPage();
    fireEvent.click(screen.getByText(/Criar Backup Agora/i));
    expect(props.onCreateBackup).toHaveBeenCalledTimes(1);
  });

  it('restores a backup only after the user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderPage();
    fireEvent.click(screen.getByText(/Restaurar/i));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onRestoreBackup).toHaveBeenCalledWith('backup_rede_2026-07-23_03-15-12.reg');
  });

  it('does not restore when the user cancels the confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = renderPage();
    fireEvent.click(screen.getByText(/Restaurar/i));
    expect(props.onRestoreBackup).not.toHaveBeenCalled();
  });
});
