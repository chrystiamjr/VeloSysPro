import React, { useState } from 'react';
import { Icon } from '../atoms/Icon';
import { TweakRow } from '../molecules/TweakRow';
import type { Tweak } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface TweakCatalogListProps {
  tweaks: Tweak[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onRevert: (id: string) => void;
  disabled?: boolean;
  /** False until the host has answered once, so loading is not shown as "nothing to optimize". */
  loaded?: boolean;
  /** True when the host's last catalog was refused and these rows are the previous ones. */
  stale?: boolean;
}

/**
 * Categories the UI has copy for, in the order they are shown; anything else still renders, under
 * a translated fallback. Ordered roughly by how many people will recognize what the section is for,
 * not by hive or by reboot cost — a section holds a mix of both, and the per-row restart badge is
 * what actually tells the user when a change lands.
 */
const KNOWN_CATEGORIES = ['cpu', 'graphics', 'network', 'system', 'windows', 'boot', 'services'];

/**
 * The catalog, grouped so it stays readable as it grows, with the Advanced tier held apart.
 *
 * Advanced Tweaks are collected into their own collapsed section rather than sitting inside a
 * category: they reduce security, and the one thing that must never happen is a user ticking one
 * while skimming a list of ordinary optimizations (docs/adr/0005-advanced-risk-tier.md).
 */
export const TweakCatalogList: React.FC<TweakCatalogListProps> = ({
  tweaks,
  selectedIds,
  onToggle,
  onRevert,
  disabled = false,
  loaded = true,
  stale = false,
}) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const safe = tweaks.filter((tweak) => tweak.riskTier === 'Safe');
  const advanced = tweaks.filter((tweak) => tweak.riskTier === 'Advanced');

  // Deterministic: known categories in their documented order, then anything unknown, grouped
  // under a fallback heading rather than dropped.
  const known = KNOWN_CATEGORIES.filter((category) =>
    safe.some((tweak) => tweak.category === category)
  );
  const unknown = safe.filter((tweak) => !KNOWN_CATEGORIES.includes(tweak.category));

  const renderRows = (rows: Tweak[]) =>
    rows.map((tweak) => (
      <TweakRow
        key={tweak.id}
        tweak={tweak}
        selected={selectedIds.includes(tweak.id)}
        onToggle={onToggle}
        onRevert={onRevert}
        disabled={disabled}
      />
    ));

  const sectionHeading = (label: string, rows: Tweak[]) => (
    <div className="flex items-baseline justify-between border-b border-borderColor px-5 py-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-textMuted">{label}</h4>
      <span className="text-[11px] text-textMuted">
        {t('optimize.sectionCount', {
          selected: rows.filter((tweak) => selectedIds.includes(tweak.id)).length,
          total: rows.length,
        })}
      </span>
    </div>
  );

  if (!loaded) {
    return (
      <div
        data-cy="tweak-catalog-loading"
        className="rounded-xl border border-borderColor bg-bgCard p-8 text-center text-xs text-textMuted"
      >
        {t('optimize.loading')}
      </div>
    );
  }

  if (tweaks.length === 0) {
    return (
      <div
        data-cy="tweak-catalog"
        className="rounded-xl border border-borderColor bg-bgCard p-8 text-center text-xs text-textMuted"
      >
        {t('optimize.empty')}
      </div>
    );
  }

  return (
    <div data-cy="tweak-catalog" className="flex flex-col gap-6">
      {stale && (
        <p
          data-cy="tweak-catalog-stale"
          role="status"
          className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-xs text-warning"
        >
          {t('optimize.staleRead')}
        </p>
      )}

      {known.map((category) => {
        const rows = safe.filter((tweak) => tweak.category === category);
        return (
          <section
            key={category}
            data-cy={`tweak-category-${category}`}
            className="overflow-hidden rounded-xl border border-borderColor bg-bgCard"
          >
            {sectionHeading(t(`optimize.category.${category}`), rows)}
            {renderRows(rows)}
          </section>
        );
      })}

      {unknown.length > 0 && (
        <section
          data-cy="tweak-category-other"
          className="overflow-hidden rounded-xl border border-borderColor bg-bgCard"
        >
          {sectionHeading(t('optimize.category.other'), unknown)}
          {renderRows(unknown)}
        </section>
      )}

      {advanced.length > 0 && (
        <section
          data-cy="tweak-advanced-section"
          className="overflow-hidden rounded-xl border border-warning/40 bg-bgCard"
        >
          <button
            type="button"
            data-cy="tweak-advanced-toggle"
            aria-expanded={advancedOpen}
            aria-controls="tweak-advanced-rows"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-5 py-3 text-left transition-colors hover:bg-warning/20"
          >
            <span className="flex items-center gap-2">
              <Icon name="alert-triangle" className="h-4 w-4 text-warning" />
              <span>
                <span className="block text-xs font-bold uppercase tracking-wide text-warning">
                  {t('optimize.advancedTitle')}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-textMuted">
                  {t('optimize.advancedDesc')}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-textMuted">
              {t('optimize.sectionCount', {
                selected: advanced.filter((tweak) => selectedIds.includes(tweak.id)).length,
                total: advanced.length,
              })}
              <Icon name={advancedOpen ? 'chevron-up' : 'chevron-down'} className="h-4 w-4" />
            </span>
          </button>

          {advancedOpen && <div id="tweak-advanced-rows">{renderRows(advanced)}</div>}
        </section>
      )}
    </div>
  );
};
