import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PresetCard } from '../../../src/components/molecules/PresetCard';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const renderCard = (props: Partial<React.ComponentProps<typeof PresetCard>> = {}) => {
  const merged = {
    title: 'Predefinição Rápida',
    description: 'Tudo que o catálogo oferece hoje.',
    count: 3,
    categories: ['Processador e prioridades', 'Serviços do Windows'],
    icon: 'sliders' as const,
    accent: 'purple' as const,
    onClick: vi.fn(),
    testId: 'tweak-preset-quick',
    ...props,
  };
  const { container } = render(
    <LanguageProvider>
      <PresetCard {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

describe('PresetCard', () => {
  it('says what it turns on instead of only naming itself', () => {
    renderCard();

    expect(screen.getByText('Predefinição Rápida')).toBeInTheDocument();
    expect(screen.getByText('Tudo que o catálogo oferece hoje.')).toBeInTheDocument();
    expect(screen.getByText('3 otimizações')).toBeInTheDocument();
  });

  it('lists the parts of the system it touches', () => {
    renderCard();

    expect(
      screen.getByText('Processador e prioridades · Serviços do Windows')
    ).toBeInTheDocument();
  });

  it('omits the category line when there is nothing to list', () => {
    renderCard({ categories: [], count: 0 });

    expect(screen.getByText('0 otimizações')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('reports whether it is the selection currently drawn', () => {
    const { container } = renderCard({ active: true });

    expect(container.querySelector('[data-cy="tweak-preset-quick"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('is a single control, so the whole card is what gets clicked', () => {
    const { container, onClick } = renderCard();

    fireEvent.click(container.querySelector('[data-cy="tweak-preset-quick"]')!);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cannot be picked while a mutation is in flight', () => {
    const { container, onClick } = renderCard({ disabled: true });

    fireEvent.click(container.querySelector('[data-cy="tweak-preset-quick"]')!);

    expect(onClick).not.toHaveBeenCalled();
  });
});
