import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from '../../../src/components/atoms/Select';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

describe('Select', () => {
  it('renders every option and the current value', () => {
    render(<Select value="b" onChange={vi.fn()} options={options} />);

    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('b');
  });

  it('reports the selected value', () => {
    const onChange = vi.fn();
    render(<Select value="a" onChange={onChange} options={options} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  // The native arrow sits flush against the border; appearance-none plus right padding is
  // what moves it away, so both must stay.
  it('suppresses the native arrow and reserves room for the custom chevron', () => {
    render(<Select value="a" onChange={vi.fn()} options={options} />);
    const select = screen.getByRole('combobox');

    expect(select).toHaveClass('appearance-none');
    expect(select).toHaveClass('pr-10');
  });

  it('renders a chevron that cannot swallow clicks meant for the select', () => {
    const { container } = render(<Select value="a" onChange={vi.fn()} options={options} />);
    const chevron = container.querySelector('svg');

    expect(chevron).toHaveClass('pointer-events-none');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards id and testId so a label can reach it', () => {
    const { container } = render(
      <Select value="a" onChange={vi.fn()} options={options} id="my-field" testId="my-cy" />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'my-field');
    expect(container.querySelector('[data-cy="my-cy"]')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<Select value="a" onChange={vi.fn()} options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
