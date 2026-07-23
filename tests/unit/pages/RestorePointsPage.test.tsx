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
  render(
    <LanguageProvider>
      <RestorePointsPage {...merged} />
    </LanguageProvider>
  );
  return merged;
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
});
