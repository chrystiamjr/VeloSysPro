import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SnapshotDiff } from '../../../src/components/organisms/SnapshotDiff';
import type { OptimizationSnapshot } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const before: OptimizationSnapshot = {
  capturedAt: '2026-07-25T10:00:00.000Z',
  bootDurationMs: 32000,
  freeMemoryBytes: 4194304,
  totalMemoryBytes: 17179869184,
  freeDiskBytes: 10485760,
  totalDiskBytes: 500000000000,
  automaticServices: 100,
  runningServices: 80,
  startupApps: 15,
  pendingReboot: false,
};

const after: OptimizationSnapshot = {
  ...before,
  capturedAt: '2026-07-25T10:04:00.000Z',
  bootDurationMs: 21500,
  freeMemoryBytes: 8388608,
  automaticServices: 94,
  runningServices: 71,
  pendingReboot: true,
};

const renderDiff = (snapshot: React.ComponentProps<typeof SnapshotDiff>['snapshot']) => {
  const { container } = render(
    <LanguageProvider>
      <SnapshotDiff snapshot={snapshot} />
    </LanguageProvider>
  );
  return container;
};

const cells = (container: HTMLElement, metric: string) =>
  [...container.querySelectorAll(`[data-cy="snapshot-metric-${metric}"] td`)].map(
    (cell) => cell.textContent
  );

describe('SnapshotDiff', () => {
  it('invites a measurement when nothing has been captured yet', () => {
    renderDiff(null);

    expect(screen.getByText(/Aplique otimizações para ver/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('puts the before and after values of every metric side by side', () => {
    const container = renderDiff({ before, after });

    expect(cells(container, 'bootDuration')).toEqual([
      'Duração do último boot',
      '32,0 s',
      '21,5 s',
    ]);
    expect(cells(container, 'freeMemory')).toEqual(['Memória livre', '4.096,0 KB', '8.192,0 KB']);
    expect(cells(container, 'runningServices')).toEqual(['Serviços em execução', '80', '71']);
  });

  it('renders boolean metrics as words, not as raw true/false', () => {
    const container = renderDiff({ before, after });

    expect(cells(container, 'pendingReboot')).toEqual(['Reinicialização pendente', 'Não', 'Sim']);
  });

  it('marks a standalone measurement as having no baseline', () => {
    const container = renderDiff({ before: null, after });

    expect(cells(container, 'runningServices')).toEqual(['Serviços em execução', '—', '71']);
  });

  it('treats an unreadable boot duration as not measured rather than instant', () => {
    const container = renderDiff({ before: null, after: { ...after, bootDurationMs: 0 } });

    expect(cells(container, 'bootDuration')).toEqual(['Duração do último boot', '—', '—']);
  });

  it('stamps the comparison with when it was measured', () => {
    const container = renderDiff({ before, after });

    const stamp = container.querySelector('[data-cy="snapshot-captured-at"]') as HTMLElement;
    expect(within(stamp).getByText(/Medição feita em/)).toBeInTheDocument();
    expect(stamp.textContent).not.toContain('{{');
  });

  it('keeps the table inside its own horizontal scroller', () => {
    const container = renderDiff({ before, after });

    expect(container.querySelector('[data-cy="snapshot-diff"]')).toHaveClass('overflow-x-auto');
  });
});
