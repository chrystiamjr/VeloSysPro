import React from 'react';
import { Icon } from './Icon';
import type { RiskTier } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface RiskBadgeProps {
  tier: RiskTier;
}

/**
 * A Tweak's safety classification.
 *
 * Carries an icon and a word, never colour alone: the whole point of the badge is that someone who
 * cannot distinguish the two hues still sees that one of these reduces their security
 * (docs/adr/0005-advanced-risk-tier.md).
 */
export const RiskBadge: React.FC<RiskBadgeProps> = ({ tier }) => {
  const { t } = useTranslation();
  const advanced = tier === 'Advanced';

  return (
    <span
      data-cy={`risk-badge-${tier}`}
      title={t(advanced ? 'optimize.risk.advancedHint' : 'optimize.risk.safeHint')}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
        advanced
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-success/30 bg-success/10 text-success'
      }`}
    >
      <Icon name={advanced ? 'alert-triangle' : 'shield-check'} className="h-3 w-3" />
      {t(advanced ? 'optimize.risk.advanced' : 'optimize.risk.safe')}
    </span>
  );
};
