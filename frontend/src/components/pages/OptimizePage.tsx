import React, { useMemo, useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { SystemProtectionNotice } from '../molecules/SystemProtectionNotice';
import { PresetPicker } from '../organisms/PresetPicker';
import { ConfirmDialog, ConfirmItem } from '../organisms/ConfirmDialog';
import { SnapshotDiff } from '../organisms/SnapshotDiff';
import { TweakCatalogList } from '../organisms/TweakCatalogList';
import type { Preset, SnapshotCapturedPayload, TweakCatalog } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface OptimizePageProps {
  catalog: TweakCatalog;
  snapshot: SnapshotCapturedPayload | null;
  onApply: (change: { tweakIds: string[]; revertIds: string[] }) => void;
  onRevert: (tweakId: string) => void;
  onRefresh: () => void;
  onEnableProtection: () => void;
  disabled?: boolean;
  catalogLoaded?: boolean;
  catalogStale?: boolean;
}

const sameSet = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

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
  catalogLoaded = true,
  catalogStale = false,
}) => {
  const { t } = useTranslation();

  // Partial counts as not applied: re-applying resolves it, and treating it as applied would offer
  // to "revert" a Tweak that was never fully in place.
  const appliedIds = useMemo(
    () => catalog.tweaks.filter((tweak) => tweak.state === 'Applied').map((tweak) => tweak.id),
    [catalog]
  );

  const [desiredIds, setDesiredIds] = useState<string[]>(appliedIds);
  const [lastApplied, setLastApplied] = useState<string[]>(appliedIds);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetSelection, setPresetSelection] = useState<string[] | null>(null);
  const [pending, setPending] = useState<{ apply: string[]; revert: string[] } | null>(null);
  const [singleRevert, setSingleRevert] = useState<string | null>(null);

  // Compared by value, not by object identity, because the host re-emits the catalog for three
  // different reasons. A plain refresh reports the same applied set and must leave the user's drawn
  // intent alone; a batch that actually changed the machine reports a different one, and then the
  // screen has to show reality rather than what was wanted. Adjusted during render instead of in an
  // effect — the pattern DataTable uses to clamp its page.
  if (!sameSet(appliedIds, lastApplied)) {
    setLastApplied(appliedIds);
    setDesiredIds(appliedIds);
    setActivePresetId(null);
    setPresetSelection(null);
  }

  // Anything the host stopped reporting cannot be acted on, whatever the user drew earlier.
  const knownIds = catalog.tweaks.map((tweak) => tweak.id);
  const liveDesired = desiredIds.filter((id) => knownIds.includes(id));

  const toApply = liveDesired.filter((id) => !appliedIds.includes(id));
  const toRevert = appliedIds.filter((id) => !liveDesired.includes(id));
  const hasPendingChange = toApply.length > 0 || toRevert.length > 0;

  const advancedToApply = toApply.filter(
    (id) => catalog.tweaks.find((tweak) => tweak.id === id)?.riskTier === 'Advanced'
  );

  const titleOf = (id: string) => t(`optimize.tweak.${id}.title`);
  const modified = presetSelection !== null && !sameSet(liveDesired, presetSelection);
  const recommendedActive =
    presetSelection !== null && activePresetId === null && sameSet(liveDesired, presetSelection);

  const toggle = (id: string) =>
    setDesiredIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  // A Preset and the recommended set may only draw Safe Tweaks. The host enforces this when it
  // builds the catalog; it is enforced again here because these are the controls a non-expert
  // clicks without reading, so malformed or stale host data must not tick an Advanced Tweak for
  // them. An Advanced Tweak already applied stays ticked — unticking it would stage a revert
  // nobody asked for.
  const drawSafeOnly = (ids: string[]) => {
    const safe = ids.filter((id) =>
      catalog.tweaks.some((tweak) => tweak.id === id && tweak.riskTier === 'Safe')
    );
    const appliedAdvanced = appliedIds.filter(
      (id) => catalog.tweaks.find((tweak) => tweak.id === id)?.riskTier === 'Advanced'
    );
    return [...safe, ...appliedAdvanced];
  };

  const pickPreset = (preset: Preset) => {
    const drawn = drawSafeOnly(preset.tweakIds);
    setDesiredIds(drawn);
    setPresetSelection(drawn);
    setActivePresetId(preset.id);
  };

  const pickRecommended = () => {
    const drawn = drawSafeOnly(
      catalog.tweaks.filter((tweak) => tweak.recommended).map((tweak) => tweak.id)
    );
    setDesiredIds(drawn);
    setPresetSelection(drawn);
    setActivePresetId(null);
  };

  const clear = () => {
    setDesiredIds(drawSafeOnly([]));
    setActivePresetId(null);
    setPresetSelection(null);
  };

  const submit = () => {
    // Revalidated one last time against the catalog as it stands right now: the list may have been
    // re-read while the user was deciding.
    const apply = toApply.filter((id) => knownIds.includes(id));
    const revert = toRevert.filter((id) => knownIds.includes(id));
    if (apply.length === 0 && revert.length === 0) return;

    // Undoing work and turning off a security protection both deserve a stop; applying an ordinary
    // optimization is already what the button says it does.
    if (revert.length > 0 || apply.some((id) => advancedToApply.includes(id))) {
      setPending({ apply, revert });
      return;
    }
    onApply({ tweakIds: apply, revertIds: revert });
  };

  const confirmSubmit = () => {
    const batch = pending;
    setPending(null);
    if (batch) onApply({ tweakIds: batch.apply, revertIds: batch.revert });
  };

  const pendingAdvanced = (pending?.apply ?? []).filter((id) => advancedToApply.includes(id));
  const confirmItems: ConfirmItem[] = [
    ...pendingAdvanced.map((id) => ({
      label: titleOf(id),
      detail: t(`optimize.tweak.${id}.risk`),
    })),
    ...(pending?.revert ?? []).map((id) => ({
      label: titleOf(id),
      detail: t('optimize.revertItemDetail'),
    })),
  ];

  return (
    <div className="flex min-h-full flex-1 select-none flex-col gap-6">
      {!catalog.systemProtectionEnabled && (
        <SystemProtectionNotice onEnable={onEnableProtection} disabled={disabled} />
      )}

      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-bold text-white">{t('optimize.sectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('optimize.sectionDesc')}</p>
          </div>

          <PresetPicker
            presets={catalog.presets}
            tweaks={catalog.tweaks}
            activePresetId={activePresetId}
            modified={modified}
            recommendedActive={recommendedActive}
            onPick={pickPreset}
            onRecommended={pickRecommended}
            onClear={clear}
            onRefresh={onRefresh}
            disabled={disabled}
          />
        </div>
      </div>

      <TweakCatalogList
        tweaks={catalog.tweaks}
        selectedIds={liveDesired}
        onToggle={toggle}
        onRevert={setSingleRevert}
        disabled={disabled}
        loaded={catalogLoaded}
        stale={catalogStale}
      />

      <SnapshotDiff snapshot={snapshot} />

      {/* Bleeds through the page padding to span the whole content panel, so it reads as a bar the
          screen sits on rather than one more card in the stack. Sticky so the pending difference
          and the action stay in view however far the catalog scrolls. */}
      <div
        data-cy="tweak-action-bar"
        className="sticky bottom-0 z-20 -mx-4 mt-auto flex flex-col gap-3 border-t border-borderColor bg-bgSidebar/95 px-4 py-4 shadow-action-bar backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8"
      >
        <span data-cy="tweak-pending-summary" className="text-xs text-textMuted">
          {hasPendingChange
            ? t('optimize.pending', { apply: toApply.length, revert: toRevert.length })
            : t('optimize.noPending')}
        </span>
        <Button
          testId="tweak-apply"
          variant="success"
          fullWidth={false}
          className="items-center gap-2 px-6"
          disabled={disabled || !hasPendingChange}
          onClick={submit}
        >
          <Icon name="rocket" /> {t('optimize.applyBtn')}
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        testId="revert-confirm"
        icon={pendingAdvanced.length > 0 ? 'alert-triangle' : 'rotate-ccw'}
        confirmVariant={pendingAdvanced.length > 0 ? 'danger' : 'warning'}
        title={t(
          pendingAdvanced.length > 0
            ? 'optimize.advancedConfirmTitle'
            : 'optimize.revertConfirmTitle'
        )}
        message={t(
          pendingAdvanced.length > 0
            ? 'optimize.advancedConfirmBody'
            : 'optimize.revertConfirmBody',
          { revert: pending?.revert.length ?? 0, apply: pending?.apply.length ?? 0 }
        )}
        items={confirmItems}
        confirmLabel={t(
          pendingAdvanced.length > 0 ? 'optimize.advancedConfirmBtn' : 'optimize.revertConfirmBtn'
        )}
        onConfirm={confirmSubmit}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={singleRevert !== null}
        testId="single-revert-confirm"
        title={t('optimize.revertConfirmTitle')}
        message={t('optimize.revertSingleBody')}
        items={singleRevert ? [{ label: titleOf(singleRevert) }] : []}
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
