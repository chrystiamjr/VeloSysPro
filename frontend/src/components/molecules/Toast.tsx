import React from 'react';
import { Icon } from '../atoms/Icon';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface ToastProps {
  /** Whether the run the host reported succeeded. */
  ok: boolean;
  /** The host's last word on the run, already translated. */
  detail?: string;
  onDismiss: () => void;
  /** Offered on a failure only, where the full trail is worth reaching for. */
  onViewLog?: () => void;
  testId?: string;
}

/**
 * One outcome report, floating over whichever screen the user is on.
 *
 * The heading only says whether the run worked; the detail beneath it is the host's own message
 * and carries the reason. That split is deliberate — a heading per Action would be a second
 * vocabulary to keep in step with the log, and the two would eventually disagree.
 */
export const Toast: React.FC<ToastProps> = ({ ok, detail, onDismiss, onViewLog, testId }) => {
  const { t } = useTranslation();

  return (
    <div
      data-cy={testId}
      // A failure interrupts a screen reader; a success waits its turn.
      role={ok ? 'status' : 'alert'}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-bgCard p-4 shadow-lg ${
        ok ? 'border-success/40' : 'border-danger/50'
      }`}
    >
      <Icon
        name={ok ? 'check-circle' : 'alert-triangle'}
        className={`mt-0.5 h-5 w-5 shrink-0 ${ok ? 'text-success' : 'text-danger'}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-textMain">{t(ok ? 'toast.ok' : 'toast.fail')}</p>
        {detail && <p className="mt-1 break-words text-xs text-textMuted">{detail}</p>}
        {!ok && onViewLog && (
          <button
            data-cy="toast-view-log"
            onClick={onViewLog}
            className="mt-2 cursor-pointer rounded-lg border border-borderColor bg-transparent px-3 py-1.5 text-xs font-semibold text-textMain transition-colors hover:bg-bgCardHover"
          >
            {t('toast.viewLog')}
          </button>
        )}
      </div>

      <button
        data-cy="toast-dismiss"
        aria-label={t('toast.dismiss')}
        onClick={onDismiss}
        className="cursor-pointer border-none bg-transparent p-0 text-textMuted transition-colors hover:text-textMain"
      >
        <Icon name="x-circle" className="h-4 w-4" />
      </button>
    </div>
  );
};
