import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompactActionItem } from '../../../src/components/molecules/CompactActionItem';

describe('CompactActionItem Molecule Component', () => {
  it('executes its action and supports a disabled state', () => {
    const onExecute = vi.fn();
    const { rerender } = render(
      <CompactActionItem
        title="Disk Health"
        desc="Read-only report"
        icon={<span>icon</span>}
        buttonText="View"
        onExecute={onExecute}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onExecute).toHaveBeenCalledOnce();

    rerender(
      <CompactActionItem
        title="Disk Health"
        desc="Read-only report"
        icon={<span>icon</span>}
        buttonText="View"
        disabled
        onExecute={onExecute}
      />
    );
    expect(screen.getByRole('button', { name: 'View' })).toBeDisabled();
  });
});
