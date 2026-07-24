import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestorePointsPage } from '../../../src/components/pages/RestorePointsPage';
import { RestorePointItem } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const points: RestorePointItem[] = [
  { Sequence: 12, Date: '23/07/2026 03:15', Description: 'VeloSysPro_2026-07-23' },
];

const renderPage = (props: Partial<React.ComponentProps<typeof RestorePointsPage>> = {}) => {
  const merged = {
    points,
    onCreatePoint: vi.fn(),
    onRestore: vi.fn(),
    ...props,
  };
  const { container } = render(
    <LanguageProvider>
      <RestorePointsPage {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

describe('RestorePointsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists existing restore points', () => {
    renderPage();
    expect(screen.getByText('VeloSysPro_2026-07-23')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows an empty state when there are no points', () => {
    renderPage({ points: [] });
    expect(screen.getByText(/Nenhum ponto de restauração/i)).toBeInTheDocument();
  });

  it('creates a restore point', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Criar Ponto/i }));
    expect(props.onCreatePoint).toHaveBeenCalledTimes(1);
  });

  it('renders the card heading before its full-width create action', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /Criar Ponto/i });
    const heading = screen.getByRole('heading', { name: /Pontos de Restauração do Sistema/i });
    const content = button.parentElement;

    expect(content).toHaveClass('flex-col');
    expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('restores only after BOTH confirmations pass', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Restaurar/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(props.onRestore).toHaveBeenCalledWith(12);
  });

  it('does not restore if the second confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Restaurar/i }));
    expect(props.onRestore).not.toHaveBeenCalled();
  });

  it('lists the newest restore points first and paginates long histories', () => {
    const many: RestorePointItem[] = Array.from({ length: 24 }, (_, i) => ({
      Sequence: 115 + i,
      Date: `${String((i % 28) + 1).padStart(2, '0')}/07/2026 03:00`,
      Description: `Point ${115 + i}`,
    }));
    renderPage({ points: many });

    // Newest sequence first, and only the first page is rendered.
    expect(screen.getByText('Point 138')).toBeInTheDocument();
    expect(screen.queryByText('Point 128')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–10 de 24')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(screen.getByText('Point 128')).toBeInTheDocument();
  });

  it('sorts by date chronologically rather than by the raw display string', () => {
    const crossYear: RestorePointItem[] = [
      { Sequence: 2, Date: '01/01/2026 00:00', Description: 'newer' },
      { Sequence: 1, Date: '31/12/2025 23:00', Description: 'older' },
    ];
    const { container } = renderPage({ points: crossYear });

    fireEvent.click(container.querySelector('[data-cy="table-sort-date"]')!);
    const firstRowCells = screen.getAllByRole('row')[1].querySelectorAll('td');
    expect(firstRowCells[2]).toHaveTextContent('older');
  });

  it('keeps the table horizontally scrollable on narrow windows', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="restore-points-table"]')).toHaveClass(
      'overflow-x-auto'
    );
    expect(screen.getByRole('table')).toHaveClass('min-w-[640px]');
  });
});
