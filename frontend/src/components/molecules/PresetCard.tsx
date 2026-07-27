import React from 'react';
import { Icon, IconName } from '../atoms/Icon';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface PresetCardProps {
  /** Already-translated name of the starting point. */
  title: string;
  /** Already-translated sentence saying what it turns on. */
  description: string;
  /** How many Tweaks it draws. */
  count: number;
  /** Already-translated category names it spans, in catalog order. */
  categories: string[];
  icon: IconName;
  accent: 'purple' | 'success';
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId: string;
}

const accents = {
  purple: {
    ring: 'border-purple/60 bg-purple/10',
    idle: 'border-borderColor bg-bgMain/40 hover:border-purple/40 hover:bg-bgCardHover',
    icon: 'bg-purple/15 text-purple',
  },
  success: {
    ring: 'border-success/60 bg-success/10',
    idle: 'border-borderColor bg-bgMain/40 hover:border-success/40 hover:bg-bgCardHover',
    icon: 'bg-success/15 text-success',
  },
};

/**
 * One curated starting point, stated rather than named.
 *
 * "Quick preset" and "Recommended" mean nothing on their own, and as two identical buttons they
 * competed with Clear and Refresh for attention. The card says what it turns on, how many
 * optimizations that is, and which parts of the system it touches — all read from the live
 * catalog, so it stays true as the catalog grows.
 */
export const PresetCard: React.FC<PresetCardProps> = ({
  title,
  description,
  count,
  categories,
  icon,
  accent,
  active = false,
  disabled = false,
  onClick,
  testId,
}) => {
  const { t } = useTranslation();
  const style = accents[accent];

  return (
    <button
      type="button"
      data-cy={testId}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-full min-h-36 cursor-pointer flex-col justify-between gap-3 rounded-container border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? style.ring : style.idle
      }`}
    >
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.icon}`}
          >
            <Icon name={icon} />
          </span>
          <span className="text-sm font-bold text-textMain">{title}</span>
          {active && <Icon name="check" className="ml-auto h-4 w-4 text-textMuted" />}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-textMuted">{description}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-textMain">
          {t('optimize.presetCount', { count })}
        </span>
        {categories.length > 0 && (
          <span className="text-[11px] leading-relaxed text-textMuted">
            {categories.join(' · ')}
          </span>
        )}
      </div>
    </button>
  );
};
