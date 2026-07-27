import React, { useEffect, useRef } from 'react';
import { Button } from '../atoms/Button';
import { Icon, IconName } from '../atoms/Icon';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface ConfirmItem {
  /** Already-translated name of the thing being touched. */
  label: string;
  /** Already-translated reason it deserves a second look, e.g. an Advanced Tweak's risk. */
  detail?: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  /** Already-translated heading. */
  title: string;
  /** Already-translated explanation of what is about to happen. */
  message: string;
  /** Already-translated lines naming exactly what the action will touch. */
  items?: ConfirmItem[];
  /** Already-translated label for the action that goes ahead. */
  confirmLabel: string;
  confirmVariant?: 'warning' | 'danger' | 'success';
  icon?: IconName;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

/**
 * Blocking confirmation that names what is about to change.
 *
 * `window.confirm` cannot list anything, and the decision this guards — which previously applied
 * optimizations are about to be undone — is exactly the one the user cannot make without seeing the
 * list. Cancelling is the default: Escape and the backdrop both dismiss, and nothing is dispatched
 * until the explicit confirm.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  items = [],
  confirmLabel,
  confirmVariant = 'warning',
  icon = 'rotate-ccw',
  onConfirm,
  onCancel,
  testId = 'confirm-dialog',
}) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  /**
   * Moves focus in on open and puts it back where it came from on close.
   *
   * Backing out is the safe default, so the cancel control is what receives focus: a keyboard user
   * who hits Enter reflexively must not thereby confirm undoing their work. Returning focus to the
   * control that opened the dialog is what stops a keyboard or screen-reader user being dumped at
   * the top of the page every time they dismiss one.
   */
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    cancelRef.current?.focus();

    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-cy={`${testId}-backdrop`}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bgMain/80 p-4"
    >
      <div
        data-cy={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        // The backdrop closes the dialog; clicks inside it must not bubble up and do the same.
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-borderColor bg-bgCard p-6 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h3 id={`${testId}-title`} className="text-sm font-bold text-textMain">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">{message}</p>
          </div>
        </div>

        {items.length > 0 && (
          <ul
            data-cy={`${testId}-items`}
            className="flex flex-col gap-2 rounded-lg border border-borderColor bg-bgMain/40 p-4"
          >
            {items.map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-xs text-textMain">
                <Icon name="chevron-right" className="mt-0.5 h-3 w-3 shrink-0 text-textMuted" />
                <span>
                  {item.label}
                  {item.detail && (
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-textMuted">
                      {item.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            testId={`${testId}-cancel`}
            variant="primary"
            className="w-auto px-5"
            buttonRef={cancelRef}
            onClick={onCancel}
          >
            {t('dialog.cancel')}
          </Button>
          <Button
            testId={`${testId}-confirm`}
            variant={confirmVariant}
            className="w-auto px-5"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
