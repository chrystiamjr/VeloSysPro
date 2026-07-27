import React from 'react';
import { TweakRow } from '../molecules/TweakRow';
import type { Tweak } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface TweakCatalogListProps {
  tweaks: Tweak[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onRevert: (id: string) => void;
  disabled?: boolean;
}

/** Groups the catalog by category so the list stays readable as it grows past a handful. */
export const TweakCatalogList: React.FC<TweakCatalogListProps> = ({
  tweaks,
  selectedIds,
  onToggle,
  onRevert,
  disabled = false,
}) => {
  const { t } = useTranslation();

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

  const categories = [...new Set(tweaks.map((tweak) => tweak.category))];

  return (
    <div data-cy="tweak-catalog" className="flex flex-col gap-6">
      {categories.map((category) => (
        <section
          key={category}
          data-cy={`tweak-category-${category}`}
          className="overflow-hidden rounded-xl border border-borderColor bg-bgCard"
        >
          <h4 className="border-b border-borderColor px-5 py-3 text-xs font-bold uppercase tracking-wide text-textMuted">
            {t(`optimize.category.${category}`)}
          </h4>
          {tweaks
            .filter((tweak) => tweak.category === category)
            .map((tweak) => (
              <TweakRow
                key={tweak.id}
                tweak={tweak}
                selected={selectedIds.includes(tweak.id)}
                onToggle={onToggle}
                onRevert={onRevert}
                disabled={disabled}
              />
            ))}
        </section>
      ))}
    </div>
  );
};
