import React from 'react';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import type { Tweak, TweakState } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface TweakRowProps {
  tweak: Tweak;
  selected: boolean;
  onToggle: (id: string) => void;
  onRevert: (id: string) => void;
  disabled?: boolean;
}

interface StateBadge {
  variant: 'success' | 'info' | 'warning';
  labelKey: string;
}

const STATE_BADGE: Record<TweakState, StateBadge> = {
  Applied: { variant: 'success', labelKey: 'optimize.state.applied' },
  NotApplied: { variant: 'info', labelKey: 'optimize.state.notApplied' },
  Partial: { variant: 'warning', labelKey: 'optimize.state.partial' },
};

/**
 * One selectable Tweak: a checkbox, its translated name and description, the state the host
 * detected, and — only once it is applied — the control that puts the prior state back.
 */
export const TweakRow: React.FC<TweakRowProps> = ({
  tweak,
  selected,
  onToggle,
  onRevert,
  disabled = false,
}) => {
  const { t } = useTranslation();
  // Tweak ids are dotted (cpu.win32PrioritySeparation), which is exactly the shape of a nested
  // i18n path, so a Tweak carries no display text across the IPC boundary.
  const labelKey = `optimize.tweak.${tweak.id}`;
  const badge = STATE_BADGE[tweak.state];

  return (
    <div
      data-cy={`tweak-row-${tweak.id}`}
      className="flex flex-col gap-3 border-b border-borderColor/50 px-5 py-4 last:border-none sm:flex-row sm:items-center sm:justify-between"
    >
      <label className="flex flex-1 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          data-cy={`tweak-select-${tweak.id}`}
          checked={selected}
          disabled={disabled}
          onChange={() => onToggle(tweak.id)}
          aria-label={t(`${labelKey}.title`)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <span>
          <span className="block text-sm font-bold text-textMain">{t(`${labelKey}.title`)}</span>
          <span className="mt-1 block text-xs leading-relaxed text-textMuted">
            {t(`${labelKey}.desc`)}
          </span>
        </span>
      </label>

      <div className="flex shrink-0 items-center gap-3 sm:justify-end">
        <span data-cy={`tweak-state-${tweak.id}`}>
          <Badge text={t(badge.labelKey)} variant={badge.variant} />
        </span>
        {/* Only a fully applied Tweak has a prior state worth restoring; a Partial one is
            resolved by applying it again, which E1's richer states will make explicit. */}
        {tweak.state === 'Applied' && (
          <Button
            testId={`tweak-revert-${tweak.id}`}
            variant="warning"
            className="w-auto gap-1.5 px-4 py-2"
            disabled={disabled}
            onClick={() => onRevert(tweak.id)}
          >
            <Icon name="rotate-ccw" /> {t('optimize.revertBtn')}
          </Button>
        )}
      </div>
    </div>
  );
};
