import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from '../../../src/components/organisms/ConfirmDialog';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const merged = {
    open: true,
    title: 'Confirmar reversão',
    message: 'Isto vai desfazer o que foi aplicado.',
    items: [{ label: 'SysMain em início Manual', detail: 'Volta ao valor guardado.' }],
    confirmLabel: 'Desfazer e aplicar',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  const { container } = render(
    <LanguageProvider>
      <ConfirmDialog {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    const { container } = renderDialog({ open: false });

    expect(container.querySelector('[data-cy="confirm-dialog"]')).toBeNull();
  });

  it('names exactly what the action will touch', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('SysMain em início Manual')).toBeInTheDocument();
    expect(screen.getByText('Volta ao valor guardado.')).toBeInTheDocument();
    expect(screen.getByText('Isto vai desfazer o que foi aplicado.')).toBeInTheDocument();
  });

  it('labels itself for assistive technology', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
    expect(document.getElementById('confirm-dialog-title')).toHaveTextContent('Confirmar reversão');
  });

  it('reports the explicit confirmation', () => {
    const { container, onConfirm, onCancel } = renderDialog();

    fireEvent.click(container.querySelector('[data-cy="confirm-dialog-confirm"]')!);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it.each([
    [
      'the cancel button',
      (c: HTMLElement) => c.querySelector('[data-cy="confirm-dialog-cancel"]')!,
    ],
    ['the backdrop', (c: HTMLElement) => c.querySelector('[data-cy="confirm-dialog-backdrop"]')!],
  ])('treats %s as backing out', (_label, target) => {
    const { container, onCancel, onConfirm } = renderDialog();

    fireEvent.click(target(container));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not back out when the dialog body itself is clicked', () => {
    // The backdrop dismisses; a click inside must not bubble up to it and do the same.
    const { container, onCancel } = renderDialog();

    fireEvent.click(container.querySelector('[data-cy="confirm-dialog"]')!);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('backs out on Escape', () => {
    const { onCancel } = renderDialog();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('stops listening for Escape once closed', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <LanguageProvider>
        <ConfirmDialog
          open={false}
          title="t"
          message="m"
          confirmLabel="ok"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      </LanguageProvider>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(container.querySelector('[data-cy="confirm-dialog"]')).toBeNull();
  });

  it('focuses backing out, not confirming', () => {
    // A keyboard user hitting Enter reflexively must not thereby confirm undoing their work.
    const { container } = renderDialog();

    expect(document.activeElement).toBe(
      container.querySelector('[data-cy="confirm-dialog-cancel"]')
    );
  });

  it('returns focus to whatever opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(
      <LanguageProvider>
        <ConfirmDialog
          open
          title="t"
          message="m"
          confirmLabel="ok"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </LanguageProvider>
    );
    expect(document.activeElement).not.toBe(opener);

    rerender(
      <LanguageProvider>
        <ConfirmDialog
          open={false}
          title="t"
          message="m"
          confirmLabel="ok"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('omits the list when there is nothing to enumerate', () => {
    const { container } = renderDialog({ items: [] });

    expect(container.querySelector('[data-cy="confirm-dialog-items"]')).toBeNull();
  });
});
