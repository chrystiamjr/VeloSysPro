import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DayOfMonthPicker } from '../../../src/components/molecules/DayOfMonthPicker';

const renderPicker = (props: Partial<React.ComponentProps<typeof DayOfMonthPicker>> = {}) => {
  const merged = {
    value: '1',
    onChange: vi.fn(),
    ariaLabel: 'Dia do mês',
    ...props,
  };
  const result = render(<DayOfMonthPicker {...merged} />);
  return { ...result, props: merged };
};

describe('DayOfMonthPicker', () => {
  it('renders every day of the month', () => {
    renderPicker();
    const grid = screen.getByRole('radiogroup', { name: 'Dia do mês' });
    const days = within(grid).getAllByRole('radio');

    expect(days).toHaveLength(31);
    expect(days[0]).toHaveTextContent('1');
    expect(days[30]).toHaveTextContent('31');
  });

  it('marks only the selected day as checked', () => {
    renderPicker({ value: '15' });

    expect(screen.getByRole('radio', { name: '15' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '14' })).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the clicked day', () => {
    const { props } = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: '22' }));
    expect(props.onChange).toHaveBeenCalledWith('22');
  });

  // A radiogroup is not labelable, so <label for> cannot name it — aria-label must.
  it('exposes an accessible name that a label cannot provide', () => {
    renderPicker({ ariaLabel: 'Day of month' });
    expect(screen.getByRole('radiogroup', { name: 'Day of month' })).toBeInTheDocument();
  });

  it('disables every day when disabled', () => {
    const { props } = renderPicker({ disabled: true });

    for (const day of screen.getAllByRole('radio')) {
      expect(day).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
