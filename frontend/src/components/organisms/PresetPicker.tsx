import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { PresetCard } from '../molecules/PresetCard';
import type { Preset, Tweak } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface PresetPickerProps {
  presets: Preset[];
  /** The whole catalog: the cards describe themselves from it, so they cannot go stale. */
  tweaks: Tweak[];
  /** The preset the current selection came from, or null once it has been edited. */
  activePresetId: string | null;
  /** True when a starting point was chosen and then changed by hand. */
  modified: boolean;
  /** True when the current selection is exactly the recommended set. */
  recommendedActive: boolean;
  onPick: (preset: Preset) => void;
  onRecommended: () => void;
  onClear: () => void;
  onRefresh: () => void;
  disabled?: boolean;
}

/**
 * The curated starting points, plus the two utilities that support them.
 *
 * Choosing one only *draws* a selection — nothing is applied until the action bar is used. The
 * starting points are cards because they are the decision on this screen; Clear and Refresh are
 * quiet text buttons because they are not, and as four identical bars they all read the same.
 */
export const PresetPicker: React.FC<PresetPickerProps> = ({
  presets,
  tweaks,
  activePresetId,
  modified,
  recommendedActive,
  onPick,
  onRecommended,
  onClear,
  onRefresh,
  disabled = false,
}) => {
  const { t } = useTranslation();

  /** What a starting point would actually draw: Safe Tweaks the catalog still offers. */
  const drawnBy = (ids: string[]) =>
    tweaks.filter((tweak) => ids.includes(tweak.id) && tweak.riskTier === 'Safe');

  const categoriesOf = (drawn: Tweak[]) => [
    ...new Set(drawn.map((tweak) => t(`optimize.category.${tweak.category}`))),
  ];

  const recommended = tweaks.filter((tweak) => tweak.recommended && tweak.riskTier === 'Safe');

  return (
    <div className="flex flex-col gap-3" data-cy="preset-picker">
      <span className="flex items-center gap-2 text-xs font-semibold text-textMuted">
        {t('optimize.presetLabel')}
        {modified && (
          <span data-cy="preset-modified" className="text-[11px] font-normal italic">
            {t('optimize.presetModified')}
          </span>
        )}
      </span>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => {
          const drawn = drawnBy(preset.tweakIds);
          return (
            <PresetCard
              key={preset.id}
              testId={`tweak-preset-${preset.id}`}
              title={t(`optimize.preset.${preset.id}.title`)}
              description={t(`optimize.preset.${preset.id}.desc`)}
              count={drawn.length}
              categories={categoriesOf(drawn)}
              icon="sliders"
              accent="purple"
              active={activePresetId === preset.id && !modified}
              disabled={disabled}
              onClick={() => onPick(preset)}
            />
          );
        })}

        <PresetCard
          testId="tweak-recommended"
          title={t('optimize.recommended.title')}
          description={t('optimize.recommended.desc')}
          count={recommended.length}
          categories={categoriesOf(recommended)}
          icon="check-circle"
          accent="success"
          active={recommendedActive && !modified}
          disabled={disabled}
          onClick={onRecommended}
        />
      </div>

      {/* Side by side and shorter than the cards above them: still clearly actions, but not
          competing with the choice this screen is actually about. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          testId="tweak-clear"
          variant="danger"
          className="gap-1.5 py-2.5"
          disabled={disabled}
          onClick={onClear}
        >
          <Icon name="x-circle" className="h-3.5 w-3.5" /> {t('optimize.clearBtn')}
        </Button>
        <Button
          testId="tweak-refresh"
          variant="primary"
          className="gap-1.5 py-2.5"
          disabled={disabled}
          onClick={onRefresh}
        >
          <Icon name="refresh-cw" className="h-3.5 w-3.5" /> {t('table.refresh')}
        </Button>
      </div>
    </div>
  );
};
