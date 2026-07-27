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
  lastBootUpTime: '2026-07-25T08:00:00.000Z',
};

/** Same session as `before`: the machine has not restarted between the two measurements. */
const after: OptimizationSnapshot = {
  ...before,
  capturedAt: '2026-07-25T10:04:00.000Z',
  bootDurationMs: 32000,
  freeMemoryBytes: 8388608,
  automaticServices: 94,
  runningServices: 71,
  pendingReboot: true,
};

/** A measurement taken after the machine restarted, so its boot figure is comparable. */
const afterReboot: OptimizationSnapshot = {
  ...after,
  bootDurationMs: 21500,
  lastBootUpTime: '2026-07-25T13:00:00.000Z',
};

const changes = [
  {
    tweakId: 'services.sysMain',
    setting: 'StartType',
    before: 'Automatic',
    after: 'Manual',
  },
];

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
    const container = renderDiff({ before, after, changes: [] });

    expect(cells(container, 'runningServices')).toEqual(['Serviços em execução', '80', '71']);
    expect(cells(container, 'automaticServices')).toEqual(['Serviços automáticos', '100', '94']);
  });

  it('leaves out the metrics that drift on their own and no Tweak touches', () => {
    // Free memory and free disk moved between the two readings for reasons of their own;
    // presenting them as a result of the batch was the misleading part of the first version.
    const container = renderDiff({ before, after, changes: [] });

    expect(container.querySelector('[data-cy="snapshot-metric-freeMemory"]')).toBeNull();
    expect(container.querySelector('[data-cy="snapshot-metric-freeDisk"]')).toBeNull();
  });

  it('separates what changes now from what only changes on the next startup', () => {
    renderDiff({ before, after, changes: [] });

    expect(screen.getByText('Efeito imediato')).toBeInTheDocument();
    expect(screen.getByText('Efeito na próxima inicialização')).toBeInTheDocument();
  });

  it('says to restart rather than reporting an unchanged boot figure as no gain', () => {
    // Both readings come from the same session, so the event log reports the same boot twice.
    const container = renderDiff({ before, after, changes: [] });

    expect(cells(container, 'bootDuration')).toEqual([
      'Duração do último boot',
      '32,0 s',
      'reinicie para medir',
    ]);
  });

  it('reports the real boot figure once the machine has restarted', () => {
    const container = renderDiff({ before, after: afterReboot, changes: [] });

    expect(cells(container, 'bootDuration')).toEqual([
      'Duração do último boot',
      '32,0 s',
      '21,5 s',
    ]);
  });

  it('renders boolean metrics as words, not as raw true/false', () => {
    const container = renderDiff({ before, after, changes: [] });

    expect(cells(container, 'pendingReboot')).toEqual(['Reinicialização pendente', 'Não', 'Sim']);
  });

  it('marks a standalone measurement as having no baseline', () => {
    const container = renderDiff({ before: null, after, changes: [] });

    expect(cells(container, 'runningServices')).toEqual(['Serviços em execução', '—', '71']);
  });

  it('treats an unreadable boot duration as not measured rather than instant', () => {
    const container = renderDiff({
      before: null,
      after: { ...after, bootDurationMs: 0 },
      changes: [],
    });

    expect(cells(container, 'bootDuration')).toEqual(['Duração do último boot', '—', '—']);
  });

  it('lists the settings the batch actually moved, named by their Tweak', () => {
    const container = renderDiff({ before, after, changes });

    const row = container.querySelector(
      '[data-cy="snapshot-change-services.sysMain"]'
    ) as HTMLElement;
    expect(within(row).getByText(/SysMain em início Manual/)).toBeInTheDocument();
    expect(within(row).getByText('Automatic')).toBeInTheDocument();
    expect(within(row).getByText('Manual')).toBeInTheDocument();
  });

  it('names a setting that did not exist before instead of showing a blank', () => {
    const container = renderDiff({
      before,
      after,
      changes: [
        {
          tweakId: 'boot.disableDynamicTick',
          setting: 'disabledynamictick',
          before: '',
          after: 'Yes',
        },
      ],
    });

    const row = container.querySelector(
      '[data-cy="snapshot-change-boot.disableDynamicTick"]'
    ) as HTMLElement;
    expect(within(row).getByText('(ausente)')).toBeInTheDocument();
  });

  it('hides the changes panel when the batch moved nothing', () => {
    const container = renderDiff({ before, after, changes: [] });

    expect(container.querySelector('[data-cy="snapshot-changes"]')).toBeNull();
  });

  it('stamps the comparison with when it was measured', () => {
    const container = renderDiff({ before, after, changes: [] });

    const stamp = container.querySelector('[data-cy="snapshot-captured-at"]') as HTMLElement;
    expect(within(stamp).getByText(/Medição feita em/)).toBeInTheDocument();
    expect(stamp.textContent).not.toContain('{{');
  });

  it('keeps both tables inside their own horizontal scrollers', () => {
    const container = renderDiff({ before, after, changes });

    expect(container.querySelector('[data-cy="snapshot-diff"]')).toHaveClass('overflow-x-auto');
    expect(container.querySelector('[data-cy="snapshot-changes"]')).toHaveClass('overflow-x-auto');
  });
});
