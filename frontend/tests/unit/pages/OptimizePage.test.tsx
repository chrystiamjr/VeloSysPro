import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OptimizePage } from '../../../src/components/pages/OptimizePage';
import type { TweakCatalog } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const catalog: TweakCatalog = {
  tweaks: [
    {
      id: 'cpu.win32PrioritySeparation',
      category: 'cpu',
      riskTier: 'Safe',
      kind: 'registry',
      state: 'NotApplied',
    },
    {
      id: 'boot.disableDynamicTick',
      category: 'boot',
      riskTier: 'Safe',
      kind: 'bcd',
      state: 'Applied',
    },
    {
      id: 'services.sysMain',
      category: 'services',
      riskTier: 'Safe',
      kind: 'service',
      state: 'NotApplied',
    },
  ],
  systemProtectionEnabled: true,
  presets: [
    {
      id: 'quick',
      tweakIds: ['cpu.win32PrioritySeparation', 'boot.disableDynamicTick', 'services.sysMain'],
    },
  ],
};

const allApplied: TweakCatalog = {
  ...catalog,
  tweaks: catalog.tweaks.map((tweak) => ({ ...tweak, state: 'Applied' as const })),
};

const renderPage = (props: Partial<React.ComponentProps<typeof OptimizePage>> = {}) => {
  const merged = {
    catalog,
    snapshot: null,
    onApply: vi.fn(),
    onRevert: vi.fn(),
    onRefresh: vi.fn(),
    onEnableProtection: vi.fn(),
    ...props,
  };
  const { container, rerender } = render(
    <LanguageProvider>
      <OptimizePage {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container, rerender };
};

const click = (container: HTMLElement, testId: string) =>
  fireEvent.click(container.querySelector(`[data-cy="${testId}"]`)!);

const box = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-cy="tweak-select-${id}"]`) as HTMLInputElement;

describe('OptimizePage (desired-state selection screen)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('groups the catalog by category', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="tweak-category-cpu"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="tweak-category-boot"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="tweak-category-services"]')).toBeInTheDocument();
  });

  it('starts with the boxes mirroring what the system already has', () => {
    // The contradiction the old model produced: an "Applied" badge beside an empty box.
    const { container } = renderPage();

    expect(box(container, 'boot.disableDynamicTick')).toBeChecked();
    expect(box(container, 'cpu.win32PrioritySeparation')).not.toBeChecked();
  });

  it('has nothing to submit until the drawn state differs from the live one', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="tweak-apply"]')).toBeDisabled();
    expect(screen.getByText(/Nenhuma alteração pendente/i)).toBeInTheDocument();
  });

  it('submits only the newly ticked Tweaks', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    click(container, 'tweak-apply');

    expect(onApply).toHaveBeenCalledWith({
      tweakIds: ['cpu.win32PrioritySeparation'],
      revertIds: [],
    });
  });

  it('summarizes the pending difference in both directions', () => {
    const { container } = renderPage();

    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    click(container, 'tweak-select-boot.disableDynamicTick');

    expect(screen.getByText(/1 para aplicar · 1 para reverter/)).toBeInTheDocument();
  });

  it('asks before undoing anything, naming what will be undone', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-boot.disableDynamicTick');
    click(container, 'tweak-apply');

    expect(onApply).not.toHaveBeenCalled();
    const items = container.querySelector('[data-cy="revert-confirm-items"]') as HTMLElement;
    expect(items).toHaveTextContent('Desativar tick dinâmico do temporizador');
  });

  it('submits both directions as one batch once confirmed', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-boot.disableDynamicTick');
    click(container, 'tweak-select-services.sysMain');
    click(container, 'tweak-apply');
    click(container, 'revert-confirm-confirm');

    expect(onApply).toHaveBeenCalledWith({
      tweakIds: ['services.sysMain'],
      revertIds: ['boot.disableDynamicTick'],
    });
  });

  it('dispatches nothing when the revert confirmation is dismissed', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-boot.disableDynamicTick');
    click(container, 'tweak-apply');
    click(container, 'revert-confirm-cancel');

    expect(onApply).not.toHaveBeenCalled();
    expect(container.querySelector('[data-cy="revert-confirm"]')).toBeNull();
  });

  it('does not gate a batch that only applies', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    click(container, 'tweak-apply');

    expect(container.querySelector('[data-cy="revert-confirm"]')).toBeNull();
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('turns clearing the selection into undoing everything that is applied', () => {
    const { container, onApply } = renderPage({ catalog: allApplied });

    click(container, 'tweak-clear');
    click(container, 'tweak-apply');
    click(container, 'revert-confirm-confirm');

    expect(onApply).toHaveBeenCalledWith({
      tweakIds: [],
      revertIds: [
        'cpu.win32PrioritySeparation',
        'boot.disableDynamicTick',
        'services.sysMain',
      ],
    });
  });

  it('draws a preset as the desired state', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-preset-quick');
    click(container, 'tweak-apply');

    expect(onApply).toHaveBeenCalledWith({
      tweakIds: ['cpu.win32PrioritySeparation', 'services.sysMain'],
      revertIds: [],
    });
  });

  it('refuses to draw an Advanced Tweak a malformed preset tries to include', () => {
    // The host rejects this when building the catalog; the screen refuses it again, because a
    // Preset is the one control a non-expert clicks without reading.
    const { container, onApply } = renderPage({
      catalog: {
        ...catalog,
        tweaks: [
          ...catalog.tweaks,
          {
            id: 'advanced.memoryIntegrity',
            category: 'cpu',
            riskTier: 'Advanced',
            kind: 'registry',
            state: 'NotApplied',
          },
        ],
        presets: [
          { id: 'quick', tweakIds: ['cpu.win32PrioritySeparation', 'advanced.memoryIntegrity'] },
        ],
      },
    });

    click(container, 'tweak-preset-quick');
    click(container, 'tweak-apply');
    click(container, 'revert-confirm-confirm');

    expect(onApply).toHaveBeenCalledWith({
      tweakIds: ['cpu.win32PrioritySeparation'],
      revertIds: ['boot.disableDynamicTick'],
    });
  });

  it('ignores a preset entry the catalog no longer offers', () => {
    const { container, onApply } = renderPage({
      catalog: {
        ...catalog,
        presets: [{ id: 'quick', tweakIds: ['cpu.win32PrioritySeparation', 'cpu.retired'] }],
      },
    });

    click(container, 'tweak-preset-quick');
    click(container, 'tweak-apply');
    // The preset leaves an applied Tweak unticked, so this batch also undoes one and is gated.
    click(container, 'revert-confirm-confirm');

    expect(onApply).toHaveBeenCalledWith({
      tweakIds: ['cpu.win32PrioritySeparation'],
      revertIds: ['boot.disableDynamicTick'],
    });
  });

  it('drops the drawn intent when the host re-reports the catalog', () => {
    // A partly failed batch must not leave the user looking at what they wanted instead of
    // what the machine actually has.
    const { container, rerender } = renderPage();
    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    expect(box(container, 'cpu.win32PrioritySeparation')).toBeChecked();

    rerender(
      <LanguageProvider>
        <OptimizePage
          catalog={{ ...catalog }}
          snapshot={null}
          onApply={vi.fn()}
          onRevert={vi.fn()}
          onRefresh={vi.fn()}
          onEnableProtection={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(box(container, 'cpu.win32PrioritySeparation')).not.toBeChecked();
  });

  it('reverts a single Tweak from its row after confirmation', () => {
    const { container, onRevert } = renderPage();

    click(container, 'tweak-revert-boot.disableDynamicTick');
    expect(onRevert).not.toHaveBeenCalled();

    click(container, 'single-revert-confirm-confirm');
    expect(onRevert).toHaveBeenCalledWith('boot.disableDynamicTick');
  });

  it('does not revert a single Tweak when that confirmation is dismissed', () => {
    const { container, onRevert } = renderPage();

    click(container, 'tweak-revert-boot.disableDynamicTick');
    click(container, 'single-revert-confirm-cancel');

    expect(onRevert).not.toHaveBeenCalled();
  });

  it('offers an explicit refresh that re-queries the host', () => {
    const { container, onRefresh } = renderPage();

    click(container, 'tweak-refresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the refresh control reachable when the catalog is empty', () => {
    const { container, onRefresh } = renderPage({
      catalog: { tweaks: [], presets: [], systemProtectionEnabled: true },
    });

    expect(screen.getByText(/Nenhuma otimização disponível/i)).toBeInTheDocument();
    click(container, 'tweak-refresh');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('locks every control while a mutation is in flight', () => {
    const { container } = renderPage({ disabled: true });

    for (const testId of ['tweak-refresh', 'tweak-clear', 'tweak-preset-quick']) {
      expect(container.querySelector(`[data-cy="${testId}"]`)).toBeDisabled();
    }
    expect(box(container, 'cpu.win32PrioritySeparation')).toBeDisabled();
  });

  it('keeps the action bar in view as the page scrolls', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="tweak-action-bar"]')).toHaveClass('sticky');
  });

  it('shows the comparison once a batch has been measured', () => {
    const snapshot = {
      before: null,
      changes: [],
      after: {
        capturedAt: '2026-07-25T10:04:00.000Z',
        bootDurationMs: 21500,
        freeMemoryBytes: 8388608,
        totalMemoryBytes: 17179869184,
        freeDiskBytes: 10485760,
        totalDiskBytes: 500000000000,
        automaticServices: 94,
        runningServices: 71,
        startupApps: 13,
        pendingReboot: false,
        lastBootUpTime: '2026-07-25T08:00:00.000Z',
      },
    };
    const { container } = renderPage({ snapshot });

    expect(container.querySelector('[data-cy="snapshot-diff"] table')).toBeInTheDocument();
  });
});
