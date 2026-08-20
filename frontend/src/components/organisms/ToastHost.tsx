import React, { useEffect, useRef } from 'react';
import { Toast } from '../molecules/Toast';
import { ActionFeedbackItem } from '../../infrastructure/useActionFeedback';

/** How long a success stays up. Long enough to read on a handheld, short enough not to nag. */
export const SUCCESS_DISMISS_MS = 6000;

export interface ToastHostProps {
  items: ActionFeedbackItem[];
  /** Already-translated detail per item id, so this organism stays free of i18n plumbing. */
  detailFor: (item: ActionFeedbackItem) => string | undefined;
  onDismiss: (id: number) => void;
  onViewLog: () => void;
}

/**
 * Stacks outcome reports in a corner of the window.
 *
 * A success dismisses itself; a failure does not. The user has to have seen a failure for the
 * report to be worth anything, and the whole point of this surface is that the previous one — a
 * line in a log panel on another screen — could be missed entirely.
 *
 * Anchored top-right rather than bottom: the action bar owns the bottom edge of the content
 * panel, and `tests/e2e/action-feedback.cy.ts` measures that the two never overlap rather than
 * trusting the markup.
 */
export const ToastHost: React.FC<ToastHostProps> = ({ items, detailFor, onDismiss, onViewLog }) => {
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    for (const item of items) {
      if (!item.ok || timers.current.has(item.id)) continue;

      timers.current.set(
        item.id,
        setTimeout(() => {
          timers.current.delete(item.id);
          onDismiss(item.id);
        }, SUCCESS_DISMISS_MS)
      );
    }
  }, [items, onDismiss]);

  // Timers outlive the items they belong to if the tree goes away mid-countdown.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      data-cy="toast-host"
      // pointer-events-none on the stack so the column's empty space never eats a click meant
      // for the page; each Toast turns them back on for itself.
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-auto max-w-[calc(100vw-2rem)] flex-col gap-2 sm:w-[22rem]"
    >
      {items.map((item) => (
        <Toast
          key={item.id}
          testId={`toast-${item.ok ? 'ok' : 'fail'}`}
          ok={item.ok}
          detail={detailFor(item)}
          onDismiss={() => onDismiss(item.id)}
          onViewLog={onViewLog}
        />
      ))}
    </div>
  );
};
