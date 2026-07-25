import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionGroup } from '../../../src/components/organisms/ActionGroup';

describe('ActionGroup Organism Component', () => {
  it('supports open and closed initial states and toggles its content', () => {
    render(
      <>
        <ActionGroup title="Maintenance" description="Tools" itemCount={1} defaultExpanded>
          <span>Disk Health</span>
        </ActionGroup>
        <ActionGroup title="Recovery" description="Safety" itemCount={1}>
          <span>Registry Backup</span>
        </ActionGroup>
      </>
    );

    expect(screen.getByText('Disk Health')).toBeVisible();
    expect(screen.queryByText('Registry Backup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /recovery/i }));
    expect(screen.getByText('Registry Backup')).toBeVisible();
  });
});
