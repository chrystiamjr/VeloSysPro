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
  const { container } = render(
    <LanguageProvider>
      <OptimizePage {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

const click = (container: HTMLElement, testId: string) =>
  fireEvent.click(container.querySelector(`[data-cy="${testId}"]`)!);

describe('OptimizePage (selection screen)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('groups the catalog by category', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="tweak-category-cpu"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="tweak-category-boot"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="tweak-category-services"]')).toBeInTheDocument();
  });

  it('applies exactly the Tweaks the user ticked', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    click(container, 'tweak-select-services.sysMain');
    click(container, 'tweak-apply');

    expect(onApply).toHaveBeenCalledWith(['cpu.win32PrioritySeparation', 'services.sysMain']);
  });

  it('unticks a Tweak that is clicked twice', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    click(container, 'tweak-select-services.sysMain');
    click(container, 'tweak-select-cpu.win32PrioritySeparation');
    click(container, 'tweak-apply');

    expect(onApply).toHaveBeenCalledWith(['services.sysMain']);
  });

  it('starts a selection from a preset', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-preset-quick');
    click(container, 'tweak-apply');

    expect(onApply).toHaveBeenCalledWith([
      'cpu.win32PrioritySeparation',
      'boot.disableDynamicTick',
      'services.sysMain',
    ]);
  });

  it('lets the user adjust a preset before applying it', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-preset-quick');
    click(container, 'tweak-select-boot.disableDynamicTick');
    click(container, 'tweak-apply');

    expect(onApply).toHaveBeenCalledWith(['cpu.win32PrioritySeparation', 'services.sysMain']);
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

    expect(onApply).toHaveBeenCalledWith(['cpu.win32PrioritySeparation']);
  });

  it('clears the selection', () => {
    const { container, onApply } = renderPage();

    click(container, 'tweak-preset-quick');
    click(container, 'tweak-clear');
    click(container, 'tweak-apply');

    expect(onApply).not.toHaveBeenCalled();
  });

  it('cannot apply an empty selection', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="tweak-apply"]')).toBeDisabled();
  });

  it('counts the selection on the apply control', () => {
    const { container } = renderPage();

    click(container, 'tweak-preset-quick');

    expect(screen.getByRole('button', { name: /Aplicar selecionadas \(3\)/ })).toBeInTheDocument();
  });

  it('reverts a Tweak only after the user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container, onRevert } = renderPage();

    click(container, 'tweak-revert-boot.disableDynamicTick');

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onRevert).toHaveBeenCalledWith('boot.disableDynamicTick');
  });

  it('does not revert when the user cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container, onRevert } = renderPage();

    click(container, 'tweak-revert-boot.disableDynamicTick');

    expect(onRevert).not.toHaveBeenCalled();
  });

  it('offers an explicit refresh that re-queries the host', () => {
    const { container, onRefresh } = renderPage();

    click(container, 'tweak-refresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the refresh control reachable when the catalog is empty', () => {
    const { container, onRefresh } = renderPage({ catalog: { tweaks: [], presets: [] } });

    expect(screen.getByText(/Nenhuma otimização disponível/i)).toBeInTheDocument();
    click(container, 'tweak-refresh');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('locks every control while a mutation is in flight', () => {
    const { container } = renderPage({ disabled: true });

    click(container, 'tweak-preset-quick');
    for (const testId of ['tweak-apply', 'tweak-refresh', 'tweak-clear', 'tweak-preset-quick']) {
      expect(container.querySelector(`[data-cy="${testId}"]`)).toBeDisabled();
    }
  });

  it('shows the before/after comparison once a batch has been measured', () => {
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
