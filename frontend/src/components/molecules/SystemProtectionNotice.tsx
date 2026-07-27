import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SystemProtectionNoticeProps {
  onEnable: () => void;
  disabled?: boolean;
}

/**
 * Shown when Windows System Protection is off.
 *
 * Without it no restore point can be created, so every batch would stop at its Safety Checkpoint.
 * Rather than letting the user discover that through a failed run, the screen states the
 * precondition up front, offers to fix it, and spells out the manual route for anyone who would
 * rather do it themselves.
 */
export const SystemProtectionNotice: React.FC<SystemProtectionNoticeProps> = ({
  onEnable,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <div
      data-cy="system-protection-notice"
      role="alert"
      className="flex flex-col gap-4 rounded-xl border border-warning/40 bg-warning/10 p-6"
    >
      <div className="flex items-start gap-3">
        <Icon name="shield-check" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <h4 className="text-sm font-bold text-textMain">{t('protection.title')}</h4>
          <p className="mt-1 text-xs leading-relaxed text-textMuted">{t('protection.desc')}</p>
          <p className="mt-2 text-xs leading-relaxed text-textMuted">
            {t('protection.manualPath')}
          </p>
        </div>
      </div>

      <Button
        testId="system-protection-enable"
        variant="warning"
        className="w-auto items-center gap-2 self-start px-5"
        disabled={disabled}
        onClick={onEnable}
      >
        <Icon name="shield-check" /> {t('protection.enableBtn')}
      </Button>
    </div>
  );
};
