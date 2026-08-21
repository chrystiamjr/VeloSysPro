import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { ConfirmDialog, ConfirmItem } from '../organisms/ConfirmDialog';
import { DebloatList } from '../organisms/DebloatList';
import type { DebloatPackage, DebloatResult } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface DebloatPageProps {
  packages: DebloatPackage[];
  results: DebloatResult[];
  onRemove: (packageIds: string[]) => void;
  onRefresh: () => void;
  disabled?: boolean;
  loaded?: boolean;
  stale?: boolean;
}

/**
 * The removal screen.
 *
 * Unlike the Optimize screen this is not a desired-state model, and deliberately so: a ticked box
 * here means "uninstall this", full stop. There is no revert to express, because this app cannot
 * put an app back — the standing warning and the confirmation both say so before anything is
 * dispatched, and nothing on this screen ever calls a removal reversible.
 */
export const DebloatPage: React.FC<DebloatPageProps> = ({
  packages,
  results,
  onRemove,
  onRefresh,
  disabled = false,
  loaded = true,
  stale = false,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string[] | null>(null);

  // Anything the host stopped reporting, or reported as already gone, cannot be acted on — whatever
  // the user ticked before the last refresh.
  const removableIds = packages.filter((pkg) => pkg.installed).map((pkg) => pkg.id);
  const liveSelection = selectedIds.filter((id) => removableIds.includes(id));

  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const clear = () => setSelectedIds([]);

  const submit = () => {
    if (liveSelection.length === 0) return;
    // Never dispatched straight from the button: this is the one action in the app with no undo.
    setConfirming(liveSelection);
  };

  const confirmSubmit = () => {
    const batch = confirming;
    setConfirming(null);
    if (!batch) return;
    // Re-checked against the list as it stands right now: it may have been re-read while the
    // dialog was open.
    const ids = batch.filter((id) => removableIds.includes(id));
    if (ids.length === 0) return;
    setSelectedIds([]);
    onRemove(ids);
  };

  const confirmItems: ConfirmItem[] = (confirming ?? []).map((id) => ({
    label: t(`debloat.package.${id}.title`),
    detail: t(`debloat.caveat.${packages.find((pkg) => pkg.id === id)?.caveat ?? 'store'}`),
  }));

  return (
    <div className="flex min-h-full flex-1 select-none flex-col gap-6">
      <div
        data-cy="debloat-warning"
        role="note"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-5 py-4"
      >
        <Icon name="alert-triangle" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <h3 className="text-sm font-bold text-warning">{t('debloat.warningTitle')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-textMuted">{t('debloat.warningBody')}</p>
        </div>
      </div>

      {/* Heading, then description, then actions — the stacked shape every management card on
          Backup, Restore Points and Optimize uses
          (.agents/rules/responsive-management-layouts.md). */}
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-bold text-white">{t('debloat.sectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('debloat.sectionDesc')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              testId="debloat-clear"
              variant="info"
              className="items-center gap-2 px-5"
              disabled={disabled || selectedIds.length === 0}
              onClick={clear}
            >
              <Icon name="x-circle" /> {t('debloat.clearBtn')}
            </Button>
            <Button
              testId="debloat-refresh"
              variant="primary"
              className="items-center gap-2 px-5"
              disabled={disabled}
              onClick={onRefresh}
            >
              <Icon name="refresh-cw" /> {t('debloat.refreshBtn')}
            </Button>
          </div>
        </div>
      </div>

      <DebloatList
        packages={packages}
        selectedIds={liveSelection}
        onToggle={toggle}
        results={results}
        disabled={disabled}
        loaded={loaded}
        stale={stale}
      />

      <div
        data-cy="debloat-action-bar"
        className="sticky bottom-0 z-20 -mx-4 mt-auto flex flex-col gap-3 border-t border-borderColor bg-bgSidebar/95 px-4 py-4 shadow-action-bar backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8"
      >
        <span data-cy="debloat-selection-summary" className="text-xs text-textMuted">
          {liveSelection.length > 0
            ? t('debloat.selected', { count: liveSelection.length })
            : t('debloat.noneSelected')}
        </span>
        <Button
          testId="debloat-remove"
          variant="danger"
          fullWidth={false}
          className="items-center gap-2 px-6"
          disabled={disabled || liveSelection.length === 0}
          onClick={submit}
        >
          <Icon name="trash" /> {t('debloat.removeBtn')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        testId="debloat-confirm"
        icon="alert-triangle"
        confirmVariant="danger"
        title={t('debloat.confirmTitle')}
        message={t('debloat.confirmBody', { count: confirming?.length ?? 0 })}
        items={confirmItems}
        confirmLabel={t('debloat.confirmBtn')}
        onConfirm={confirmSubmit}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
};
