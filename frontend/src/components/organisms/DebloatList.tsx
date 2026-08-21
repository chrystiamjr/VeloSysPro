import React from 'react';
import { Icon } from '../atoms/Icon';
import { DebloatRow } from '../molecules/DebloatRow';
import type { DebloatGroup, DebloatPackage, DebloatResult } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface DebloatListProps {
  packages: DebloatPackage[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  results: DebloatResult[];
  disabled?: boolean;
  /** False until the host has answered once, so loading is not shown as "nothing to remove". */
  loaded?: boolean;
  /** True when the host's last list was refused and these rows are the previous ones. */
  stale?: boolean;
}

/**
 * The allow-list, split into the two groups it is curated as.
 *
 * Optional sits in its own visibly warned section rather than mixed into the Safe list: those are
 * apps someone may be using every day, and the one thing that must not happen is a person removing
 * their camera while skimming a list of preinstalled advertising.
 */
export const DebloatList: React.FC<DebloatListProps> = ({
  packages,
  selectedIds,
  onToggle,
  results,
  disabled = false,
  loaded = true,
  stale = false,
}) => {
  const { t } = useTranslation();

  const rowsOf = (group: DebloatGroup) => packages.filter((pkg) => pkg.group === group);

  const renderRows = (rows: DebloatPackage[]) =>
    rows.map((pkg) => (
      <DebloatRow
        key={pkg.id}
        pkg={pkg}
        selected={selectedIds.includes(pkg.id)}
        onToggle={onToggle}
        disabled={disabled}
        result={results.find((result) => result.id === pkg.id)}
      />
    ));

  const sectionCount = (rows: DebloatPackage[]) =>
    t('debloat.sectionCount', {
      selected: rows.filter((pkg) => selectedIds.includes(pkg.id)).length,
      total: rows.length,
    });

  if (!loaded) {
    return (
      <div
        data-cy="debloat-loading"
        className="rounded-xl border border-borderColor bg-bgCard p-8 text-center text-xs text-textMuted"
      >
        {t('debloat.loading')}
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div
        data-cy="debloat-list"
        className="rounded-xl border border-borderColor bg-bgCard p-8 text-center text-xs text-textMuted"
      >
        {t('debloat.empty')}
      </div>
    );
  }

  const safe = rowsOf('Safe');
  const optional = rowsOf('Optional');

  return (
    <div data-cy="debloat-list" className="flex flex-col gap-6">
      {stale && (
        <p
          data-cy="debloat-stale"
          role="status"
          className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-xs text-warning"
        >
          {t('debloat.staleRead')}
        </p>
      )}

      {safe.length > 0 && (
        <section
          data-cy="debloat-group-safe"
          className="overflow-hidden rounded-xl border border-borderColor bg-bgCard"
        >
          <div className="flex items-baseline justify-between border-b border-borderColor px-5 py-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-textMuted">
              {t('debloat.group.safe')}
            </h4>
            <span className="text-[11px] text-textMuted">{sectionCount(safe)}</span>
          </div>
          {renderRows(safe)}
        </section>
      )}

      {optional.length > 0 && (
        <section
          data-cy="debloat-group-optional"
          className="overflow-hidden rounded-xl border border-warning/40 bg-bgCard"
        >
          <div className="flex items-start justify-between gap-3 border-b border-warning/30 bg-warning/10 px-5 py-3">
            <span className="flex items-center gap-2">
              <Icon name="alert-triangle" className="h-4 w-4 shrink-0 text-warning" />
              <span>
                <span className="block text-xs font-bold uppercase tracking-wide text-warning">
                  {t('debloat.group.optional')}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-textMuted">
                  {t('debloat.group.optionalDesc')}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-[11px] text-textMuted">{sectionCount(optional)}</span>
          </div>
          {renderRows(optional)}
        </section>
      )}
    </div>
  );
};
