import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HealthCard } from '../../../src/components/molecules/HealthCard';

describe('HealthCard Molecule Component (TypeScript)', () => {
  it('renders title and value properly', () => {
    render(<HealthCard title="Administrador" value="Sim" variant="success" />);
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
  });

  it('acts as an accessible navigation button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<HealthCard title="Backups" value={2} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /backups/i }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
