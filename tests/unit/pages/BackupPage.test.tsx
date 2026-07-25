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
  const { container } = render(
    <LanguageProvider>
      <BackupPage {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

const columnTexts = (index: number) =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[index].textContent);

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

  it('uses the shared heading-first card layout and keeps the table scrollable', () => {
    renderPage();
    const createButton = screen.getByRole('button', { name: /Criar Backup Agora/i });
    const heading = screen.getByRole('heading', { name: /Backups do Registro/i });
    const table = screen.getByRole('table');

    expect(
      heading.compareDocumentPosition(createButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(createButton.parentElement).toHaveClass('grid', 'sm:grid-cols-2');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
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

  it('lists the newest backup first', () => {
    renderPage({
      backups: [
        { Name: 'older.reg', Date: '31/12/2025 23:00', Size: '10.0 KB' },
        { Name: 'newer.reg', Date: '01/01/2026 00:00', Size: '10.0 KB' },
      ],
    });

    // Sorting the raw display strings would put 31/12 last.
    expect(columnTexts(0)).toEqual(['newer.reg', 'older.reg']);
  });

  it('sorts sizes by magnitude even when the host groups thousands', () => {
    const { container } = renderPage({
      backups: [
        { Name: 'small.reg', Date: '01/07/2026 10:00', Size: '999,9 KB' },
        { Name: 'big.reg', Date: '02/07/2026 10:00', Size: '1.234,5 KB' },
        { Name: 'tiny.reg', Date: '03/07/2026 10:00', Size: '45,6 KB' },
      ],
    });

    fireEvent.click(container.querySelector('[data-cy="table-sort-size"]')!);
    expect(columnTexts(0)).toEqual(['tiny.reg', 'small.reg', 'big.reg']);
  });
});
