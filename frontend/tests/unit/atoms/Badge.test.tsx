import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from '../../../src/components/atoms/Badge';

describe('Badge', () => {
  it('renders the text it is given', () => {
    render(<Badge text="Pronto" />);
    expect(screen.getByText('Pronto')).toBeInTheDocument();
  });

  // `text` used to default to a hardcoded Portuguese string, which bypassed i18n entirely.
  // Keeping it required is what prevents that from coming back.
  it('never renders an untranslated fallback', () => {
    render(<Badge text="Ready" />);
    expect(screen.queryByText(/Administrador Ativo/i)).not.toBeInTheDocument();
  });

  it('styles each variant from the design tokens, not the raw Tailwind palette', () => {
    const { container, unmount } = render(<Badge text="Pronto" variant="success" />);
    expect(container.firstChild).toHaveClass('bg-success/10', 'border-success/30', 'text-success');
    unmount();

    for (const variant of ['warning', 'danger', 'info'] as const) {
      const view = render(<Badge text="x" variant={variant} />);
      expect(view.container.firstChild).toHaveClass(
        `bg-${variant}/10`,
        `border-${variant}/30`,
        `text-${variant}`
      );
      view.unmount();
    }
  });

  it('defaults to the success variant', () => {
    const { container } = render(<Badge text="Pronto" />);
    expect(container.firstChild).toHaveClass('text-success');
  });

  it('pairs the text with a status dot', () => {
    const { container } = render(<Badge text="Pronto" variant="danger" />);
    expect(container.querySelector('.bg-danger.shadow-glow-danger')).toBeInTheDocument();
  });
});
