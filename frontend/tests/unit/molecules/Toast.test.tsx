import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from '../../../src/components/molecules/Toast';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const renderToast = (props: Partial<React.ComponentProps<typeof Toast>> = {}) => {
  const merged = {
    ok: false,
    onDismiss: vi.fn(),
    onViewLog: vi.fn(),
    testId: 'toast-fail',
    ...props,
  };
  const { container } = render(
    <LanguageProvider>
      <Toast {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

describe('Toast', () => {
  it('carries the host’s reason, not only that something failed', () => {
    renderToast({ detail: 'O Windows não criou o Ponto de Restauração.' });

    expect(screen.getByText('Algo não deu certo')).toBeInTheDocument();
    expect(screen.getByText('O Windows não criou o Ponto de Restauração.')).toBeInTheDocument();
  });

  it('interrupts a screen reader for a failure and waits its turn for a success', () => {
    const { container } = render(
      <LanguageProvider>
        <Toast ok={false} onDismiss={vi.fn()} />
        <Toast ok onDismiss={vi.fn()} />
      </LanguageProvider>
    );

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('offers the full trail only where there is a failure to investigate', () => {
    const { container } = renderToast({
      ok: true,
      detail: 'Ponto de Restauração criado com sucesso.',
    });

    expect(container.querySelector('[data-cy="toast-view-log"]')).not.toBeInTheDocument();
  });

  it('reaches the log from wherever the user is standing', () => {
    const { onViewLog, container } = renderToast();

    fireEvent.click(container.querySelector('[data-cy="toast-view-log"]')!);

    expect(onViewLog).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed', () => {
    const { onDismiss, container } = renderToast();

    fireEvent.click(container.querySelector('[data-cy="toast-dismiss"]')!);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
