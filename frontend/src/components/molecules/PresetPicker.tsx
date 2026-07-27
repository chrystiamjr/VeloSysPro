import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import type { Preset } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface PresetPickerProps {
  presets: Preset[];
  /** The preset the current selection came from, or null once it has been edited. */
  activePresetId: string | null;
  /** True when a preset was chosen and then changed by hand. */
  modified: boolean;
  onPick: (preset: Preset) => void;
  onRecommended: () => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * The curated starting points: a Preset, the recommended set, or nothing at all.
 *
 * Picking one only *draws* a selection — it never applies anything. Once the user edits what a
 * Preset drew, the picker says so, because a highlighted "Gaming" button next to a selection that
 * is no longer Gaming is the kind of small lie that makes people stop trusting the screen.
 */
export const PresetPicker: React.FC<PresetPickerProps> = ({
  presets,
  activePresetId,
  modified,
  onPick,
  onRecommended,
  onClear,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2" data-cy="preset-picker">
      <span className="flex items-center gap-2 text-xs font-semibold text-textMuted">
        {t('optimize.presetLabel')}
        {modified && (
          <span data-cy="preset-modified" className="text-[11px] font-normal italic">
            {t('optimize.presetModified')}
          </span>
        )}
      </span>

      <div className="flex flex-wrap gap-3">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            testId={`tweak-preset-${preset.id}`}
            variant="purple"
            className={`w-auto gap-2 px-5 ${
              activePresetId === preset.id && !modified ? 'ring-2 ring-white/40' : ''
            }`}
            disabled={disabled}
            onClick={() => onPick(preset)}
          >
            <Icon name="sliders" /> {t(`optimize.preset.${preset.id}`)}
          </Button>
        ))}

        <Button
          testId="tweak-recommended"
          variant="success"
          className="w-auto gap-2 px-5"
          disabled={disabled}
          onClick={onRecommended}
        >
          <Icon name="check" /> {t('optimize.recommendedBtn')}
        </Button>

        <Button
          testId="tweak-clear"
          variant="primary"
          className="w-auto gap-2 px-5"
          disabled={disabled}
          onClick={onClear}
        >
          <Icon name="x-circle" /> {t('optimize.clearBtn')}
        </Button>
      </div>
    </div>
  );
};
