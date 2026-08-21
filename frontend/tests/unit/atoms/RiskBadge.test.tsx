import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RiskBadge } from '../../../src/components/atoms/RiskBadge';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const renderBadge = (tier: 'Safe' | 'Advanced') =>
  render(
    <LanguageProvider>
      <RiskBadge tier={tier} />
    </LanguageProvider>
  ).container;

describe('RiskBadge', () => {
  it.each([
    ['Safe' as const, 'Segura'],
    ['Advanced' as const, 'Avançada'],
  ])('states the %s tier in words', (tier, label) => {
    renderBadge(tier);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('does not rely on colour alone to tell the tiers apart', () => {
    // Someone who cannot distinguish the two hues still has to see which one costs them security.
    const safe = renderBadge('Safe');
    const advanced = renderBadge('Advanced');

    expect(safe.querySelector('[data-cy="risk-badge-Safe"]')?.textContent).not.toEqual(
      advanced.querySelector('[data-cy="risk-badge-Advanced"]')?.textContent
    );
    expect(safe.querySelector('svg')).toBeInTheDocument();
    expect(advanced.querySelector('svg')).toBeInTheDocument();
  });

  it('explains the tier on hover', () => {
    const container = renderBadge('Advanced');

    expect(container.querySelector('[data-cy="risk-badge-Advanced"]')).toHaveAttribute(
      'title',
      expect.stringContaining('Reduz a segurança') as unknown as string
    );
  });
});
