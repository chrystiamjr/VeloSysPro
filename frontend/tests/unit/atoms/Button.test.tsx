import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../../../src/components/atoms/Button';

describe('Button Atom Component (Tailwind Design System)', () => {
  it('renders children correctly', () => {
    render(<Button variant="primary">Executar Agora</Button>);
    expect(screen.getByText('Executar Agora')).toBeInTheDocument();
  });

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} variant="success">
        Executar
      </Button>
    );
    fireEvent.click(screen.getByText('Executar'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick} variant="danger">
        Desabilitado
      </Button>
    );
    fireEvent.click(screen.getByText('Desabilitado'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('fills its container by default', () => {
    const { container } = render(<Button>Aplicar</Button>);

    expect(container.querySelector('button')).toHaveClass('w-full');
  });

  it('shrinks to its content when asked, without leaving w-full behind', () => {
    // Tailwind emits .w-full after .w-auto, so a "w-auto" passed through className silently lost
    // and every button that tried it stayed full width. Deciding this by prop is the whole point.
    const { container } = render(<Button fullWidth={false}>Aplicar</Button>);

    const button = container.querySelector('button')!;
    expect(button).toHaveClass('w-auto');
    expect(button).not.toHaveClass('w-full');
  });
});
