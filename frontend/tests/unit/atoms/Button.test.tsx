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
    render(<Button onClick={handleClick} variant="success">Executar</Button>);
    fireEvent.click(screen.getByText('Executar'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick} variant="danger">Desabilitado</Button>);
    fireEvent.click(screen.getByText('Desabilitado'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
