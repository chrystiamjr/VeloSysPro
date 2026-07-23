import React from 'react';
import { Badge } from '../atoms/Badge';
import { useTranslation } from '../../infrastructure/i18nContext';

/**
 * Placeholder screen for the (not-yet-implemented) Windows Task Scheduler integration.
 * Keeps the dark theme so navigating here no longer shows a blank body.
 */
export const SchedulingPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 select-none items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-borderColor bg-bgCard p-10 text-center">
        <span className="text-5xl">📅</span>
        <Badge text={t('schedulingComingSoonBadge')} variant="warning" />
        <h3 className="text-lg font-bold text-white">{t('schedulingComingSoonTitle')}</h3>
        <p className="text-xs leading-relaxed text-textMuted">{t('schedulingComingSoonDesc')}</p>
      </div>
    </div>
  );
};
