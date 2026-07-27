import React, { useMemo, useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { SystemProtectionNotice } from '../molecules/SystemProtectionNotice';
import { ConfirmDialog } from '../organisms/ConfirmDialog';
import { SnapshotDiff } from '../organisms/SnapshotDiff';
import { TweakCatalogList } from '../organisms/TweakCatalogList';
import type { SnapshotCapturedPayload, TweakCatalog } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface OptimizePageProps {
  catalog: TweakCatalog;
  snapshot: SnapshotCapturedPayload | null;
  onApply: (change: { tweakIds: string[]; revertIds: string[] }) => void;
  onRevert: (tweakId: string) => void;
  onRefresh: () => void;
  onEnableProtection: () => void;
  disabled?: boolean;
}

/**
 * The intermediate selection screen.
 *
 * A ticked box means "I want this applied", not "include this in the next run": the list starts
 * mirroring what the system already has, and the action bar submits the *difference* between what
 * the user drew and what is live. That is what lets one click both apply and undo, and it removes
 * the contradiction of an "Applied" badge sitting next to an empty checkbox.
 */
export const OptimizePage: React.FC<OptimizePageProps> = ({
  catalog,
  snapshot,
  onApply,
  onRevert,
  onRefresh,
  onEnableProtection,
  disabled = false,
}) => {
  const { t } = useTranslation();

  // Partial counts as not applied: re-applying resolves it, and treating it as applied would offer
  // to "revert" a Tweak that was never fully in place.
  const appliedIds = useMemo(
    () => catalog.tweaks.filter((tweak) => tweak.state === 'Applied').map((tweak) => tweak.id),
    [catalog]
  );

  const [desiredIds, setDesiredIds] = useState<string[]>(appliedIds);
  const [lastCatalog, setLastCatalog] = useState(catalog);
  const [pendingRevert, setPendingRevert] = useState<string[] | null>(null);
  const [singleRevert, setSingleRevert] = useState<string | null>(null);

  // The host is the authority: whenever it re-reports the catalog, the drawn intent is replaced by
  // what the machine actually has, so a partly failed batch cannot leave a stale intent on screen.
  // Adjusted during render rather than in an effect — the same pattern DataTable uses to clamp its
  // page — so there is no cascading second render (react.dev/learn/you-might-not-need-an-effect).
  if (catalog !== lastCatalog) {
    setLastCatalog(catalog);
    setDesiredIds(appliedIds);
  }

  const toApply = desiredIds.filter((id) => !appliedIds.includes(id));
  const toRevert = appliedIds.filter((id) => !desiredIds.includes(id));
  const hasPendingChange = toApply.length > 0 || toRevert.length > 0;

  const titleOf = (id: string) => t(`optimize.tweak.${id}.title`);

  const toggle = (id: string) =>
    setDesiredIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  // A Preset may only draw Safe Tweaks. The host enforces this when it builds the catalog, and it
  // is enforced again here: a Preset is what a non-expert clicks, so malformed or stale host data
  // must not be able to tick a security-reducing Tweak on their behalf.
  const applyPreset = (tweakIds: string[]) =>
    setDesiredIds(
      tweakIds.filter((id) =>
        catalog.tweaks.some((tweak) => tweak.id === id && tweak.riskTier === 'Safe')
      )
    );

  const submit = () => {
    // Only undoing needs the extra gate; applying is already what the button says it does.
    if (toRevert.length > 0) {
      setPendingRevert(toRevert);
      return;
    }
    onApply({ tweakIds: toApply, revertIds: [] });
  };

  const confirmSubmit = () => {
    setPendingRevert(null);
    onApply({ tweakIds: toApply, revertIds: toRevert });
  };

  return (
    <div className="flex select-none flex-col gap-6">
      {!catalog.systemProtectionEnabled && (
        <SystemProtectionNotice onEnable={onEnableProtection} disabled={disabled} />
      )}

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
                onClick={() => setDesiredIds([])}
              >
                <Icon name="x-circle" /> {t('optimize.clearBtn')}
              </Button>
              <Button
                testId="tweak-refresh"
                variant="primary"
                className="w-auto gap-2 px-5"
                disabled={disabled}
                onClick={onRefresh}
              >
                <Icon name="refresh-cw" /> {t('table.refresh')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <TweakCatalogList
        tweaks={catalog.tweaks}
        selectedIds={desiredIds}
        onToggle={toggle}
        onRevert={setSingleRevert}
        disabled={disabled}
      />

      <SnapshotDiff snapshot={snapshot} />

      {/* Sticky so the action stays reachable as the catalog grows past one screenful, and so the
          pending difference is always in view while the user is drawing it. */}
      <div
        data-cy="tweak-action-bar"
        className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-borderColor bg-bgCard/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
      >
        <span data-cy="tweak-pending-summary" className="text-xs text-textMuted">
          {hasPendingChange
            ? t('optimize.pending', { apply: toApply.length, revert: toRevert.length })
            : t('optimize.noPending')}
        </span>
        <Button
          testId="tweak-apply"
          variant="success"
          className="w-auto items-center gap-2 px-5"
          disabled={disabled || !hasPendingChange}
          onClick={submit}
        >
          <Icon name="rocket" /> {t('optimize.applyBtn')}
        </Button>
      </div>

      <ConfirmDialog
        open={pendingRevert !== null}
        testId="revert-confirm"
        title={t('optimize.revertConfirmTitle')}
        message={t('optimize.revertConfirmBody', {
          revert: toRevert.length,
          apply: toApply.length,
        })}
        items={(pendingRevert ?? []).map(titleOf)}
        confirmLabel={t('optimize.revertConfirmBtn')}
        onConfirm={confirmSubmit}
        onCancel={() => setPendingRevert(null)}
      />

      <ConfirmDialog
        open={singleRevert !== null}
        testId="single-revert-confirm"
        title={t('optimize.revertConfirmTitle')}
        message={t('optimize.revertSingleBody')}
        items={singleRevert ? [titleOf(singleRevert)] : []}
        confirmLabel={t('optimize.revertConfirmBtn')}
        onConfirm={() => {
          const id = singleRevert;
          setSingleRevert(null);
          if (id) onRevert(id);
        }}
        onCancel={() => setSingleRevert(null)}
      />
    </div>
  );
};
