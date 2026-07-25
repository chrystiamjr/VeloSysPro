import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FormField } from '../../../src/components/molecules/FormField';

describe('FormField', () => {
  it('associates the label with the control it names', () => {
    render(
      <FormField label="Horário" htmlFor="task-time">
        <input id="task-time" type="time" />
      </FormField>
    );

    expect(screen.getByLabelText('Horário')).toHaveAttribute('id', 'task-time');
  });

  it('renders the label before the control', () => {
    render(
      <FormField label="Horário" htmlFor="task-time">
        <input id="task-time" type="time" />
      </FormField>
    );

    const label = screen.getByText('Horário');
    const input = screen.getByLabelText('Horário');
    expect(label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('accepts grid placement classes for wide controls', () => {
    const { container } = render(
      <FormField label="Dia do mês" className="sm:col-span-2">
        <div />
      </FormField>
    );

    expect(container.firstChild).toHaveClass('sm:col-span-2', 'flex', 'flex-col');
  });
});
