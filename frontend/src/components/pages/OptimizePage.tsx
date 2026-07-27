import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { SnapshotDiff } from '../organisms/SnapshotDiff';
import { TweakCatalogList } from '../organisms/TweakCatalogList';
import type { SnapshotCapturedPayload, TweakCatalog } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface OptimizePageProps {
  catalog: TweakCatalog;
  snapshot: SnapshotCapturedPayload | null;
  onApply: (tweakIds: string[]) => void;
  onRevert: (tweakId: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

/**
 * The intermediate selection screen: pick individual Tweaks (or start from a Preset), apply them
 * behind a Safety Checkpoint, and revert any single one afterwards.
 */
export const OptimizePage: React.FC<OptimizePageProps> = ({
  catalog,
  snapshot,
  onApply,
  onRevert,
  onRefresh,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const applyPreset = (tweakIds: string[]) => {
    // A Preset is a starting selection, not a commitment: it replaces the selection and the user
    // adjusts it before applying.
    setSelectedIds(tweakIds.filter((id) => catalog.tweaks.some((tweak) => tweak.id === id)));
  };

  const handleRevert = (id: string) => {
    if (window.confirm(t('optimize.revertConfirm'))) onRevert(id);
  };

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-bold text-white">{t('optimize.sectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('optimize.sectionDesc')}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-textMuted">
              {t('optimize.presetLabel')}
            </span>
            <div className="flex flex-wrap gap-3">
              {catalog.presets.map((preset) => (
                <Button
                  key={preset.id}
                  testId={`tweak-preset-${preset.id}`}
                  variant="purple"
                  className="w-auto gap-2 px-5"
                  disabled={disabled}
                  onClick={() => applyPreset(preset.tweakIds)}
                >
                  <Icon name="sliders" /> {t(`optimize.preset.${preset.id}`)}
                </Button>
              ))}
              <Button
                testId="tweak-clear"
                variant="primary"
                className="w-auto gap-2 px-5"
                disabled={disabled}
                onClick={() => setSelectedIds([])}
              >
                <Icon name="x-circle" /> {t('optimize.clearBtn')}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              testId="tweak-apply"
              variant="success"
              className="items-center gap-2 px-5"
              disabled={disabled || selectedIds.length === 0}
              onClick={() => onApply(selectedIds)}
            >
              <Icon name="rocket" /> {t('optimize.applyBtn', { count: selectedIds.length })}
            </Button>
            <Button
              testId="tweak-refresh"
              variant="primary"
              className="items-center gap-2 px-5"
              disabled={disabled}
              onClick={onRefresh}
            >
              <Icon name="refresh-cw" /> {t('table.refresh')}
            </Button>
          </div>
        </div>
      </div>

      <TweakCatalogList
        tweaks={catalog.tweaks}
        selectedIds={selectedIds}
        onToggle={toggle}
        onRevert={handleRevert}
        disabled={disabled}
      />

      <SnapshotDiff snapshot={snapshot} />
    </div>
  );
};
