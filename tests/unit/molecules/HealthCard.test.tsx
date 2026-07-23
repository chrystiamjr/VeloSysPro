import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HealthCard } from '../../../src/components/molecules/HealthCard';

describe('HealthCard Molecule Component (TypeScript)', () => {
  it('renders title and value properly', () => {
    render(<HealthCard title="Administrador" value="Sim" variant="success" />);
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
  });
});
