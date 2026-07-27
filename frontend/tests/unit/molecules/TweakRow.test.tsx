import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TweakRow } from '../../../src/components/molecules/TweakRow';
import type { Tweak, TweakState } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const tweak: Tweak = {
  id: 'cpu.win32PrioritySeparation',
  category: 'cpu',
  riskTier: 'Safe',
  kind: 'registry',
  state: 'NotApplied',
};

const renderRow = (props: Partial<React.ComponentProps<typeof TweakRow>> = {}) => {
  const merged = {
    tweak,
    selected: false,
    onToggle: vi.fn(),
    onRevert: vi.fn(),
    ...props,
  };
  const { container } = render(
    <LanguageProvider>
      <TweakRow {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

describe('TweakRow', () => {
  it('translates the Tweak by its id instead of trusting host display text', () => {
    renderRow();

    expect(screen.getByText('Prioridade para o aplicativo em primeiro plano')).toBeInTheDocument();
    expect(screen.getByText(/quantum curto e fixo/i)).toBeInTheDocument();
  });

  it('reports the selection through onToggle without owning the state', () => {
    const props = renderRow();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).toHaveBeenCalledWith('cpu.win32PrioritySeparation');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reflects the selection it is given', () => {
    renderRow({ selected: true });

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it.each<[TweakState, string]>([
    ['Applied', 'Aplicada'],
    ['NotApplied', 'Não aplicada'],
    ['Partial', 'Parcial'],
  ])('badges the %s state detected by the host', (state, label) => {
    const { container } = renderRow({ tweak: { ...tweak, state } });

    const badge = container.querySelector(
      '[data-cy="tweak-state-cpu.win32PrioritySeparation"]'
    ) as HTMLElement;
    expect(within(badge).getByText(label)).toBeInTheDocument();
  });

  it.each<[TweakState, boolean]>([
    ['Applied', true],
    // Only a fully applied Tweak has a prior state worth restoring.
    ['Partial', false],
    ['NotApplied', false],
  ])('offers Revert for the %s state: %s', (state, visible) => {
    const { container } = renderRow({ tweak: { ...tweak, state } });

    const revert = container.querySelector('[data-cy="tweak-revert-cpu.win32PrioritySeparation"]');
    expect(Boolean(revert)).toBe(visible);
  });

  it('reverts the Tweak it belongs to', () => {
    const props = renderRow({ tweak: { ...tweak, state: 'Applied' } });

    fireEvent.click(screen.getByRole('button', { name: /Reverter/i }));

    expect(props.onRevert).toHaveBeenCalledWith('cpu.win32PrioritySeparation');
  });

  it('locks both controls while a mutation is in flight', () => {
    const { container } = renderRow({ tweak: { ...tweak, state: 'Applied' }, disabled: true });

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      container.querySelector('[data-cy="tweak-revert-cpu.win32PrioritySeparation"]')
    ).toBeDisabled();
  });
});
