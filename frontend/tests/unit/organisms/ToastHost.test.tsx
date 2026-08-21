import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUCCESS_DISMISS_MS, ToastHost } from '../../../src/components/organisms/ToastHost';
import { ActionFeedbackItem } from '../../../src/infrastructure/useActionFeedback';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const item = (overrides: Partial<ActionFeedbackItem> = {}): ActionFeedbackItem => ({
  id: 1,
  action: 'createRestorePoint',
  ok: true,
  detail: null,
  ...overrides,
});

const renderHost = (items: ActionFeedbackItem[], onDismiss = vi.fn()) => {
  const { container } = render(
    <LanguageProvider>
      <ToastHost
        items={items}
        detailFor={(entry) => entry.detail?.key}
        onDismiss={onDismiss}
        onViewLog={vi.fn()}
      />
    </LanguageProvider>
  );
  return { onDismiss, container };
};

describe('ToastHost', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing while there is nothing to report', () => {
    const { container } = renderHost([]);

    expect(container.querySelector('[data-cy="toast-host"]')).not.toBeInTheDocument();
  });

  it('lets a success dismiss itself', () => {
    const { onDismiss } = renderHost([item({ ok: true })]);

    act(() => vi.advanceTimersByTime(SUCCESS_DISMISS_MS));

    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('leaves a failure on screen until the user acknowledges it', () => {
    // The whole point of this surface is that a failure was previously missable.
    const { onDismiss, container } = renderHost([item({ ok: false })]);

    act(() => vi.advanceTimersByTime(SUCCESS_DISMISS_MS * 10));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(container.querySelector('[data-cy="toast-fail"]')).toBeInTheDocument();
  });

  it('stacks more than one report', () => {
    const { container } = renderHost([item({ id: 1, ok: false }), item({ id: 2, ok: false })]);

    expect(container.querySelectorAll('[data-cy="toast-fail"]')).toHaveLength(2);
  });
});
