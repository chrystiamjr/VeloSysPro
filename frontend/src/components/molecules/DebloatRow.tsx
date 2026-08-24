import React from 'react';
import { Badge } from '../atoms/Badge';
import { Icon } from '../atoms/Icon';
import type { DebloatPackage, DebloatResult } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface DebloatRowProps {
  pkg: DebloatPackage;
  selected: boolean;
  onToggle: (id: string) => void;
  disabled?: boolean;
  /** The outcome of the last batch for this entry, if it was part of one. */
  result?: DebloatResult;
}

/**
 * One removable app: a checkbox, its translated name and description, whether the machine has it,
 * and — after a batch — what really happened to it.
 *
 * An app the machine does not have is shown rather than hidden, because "already gone" is an
 * answer the user came here for. Its checkbox is disabled so it cannot join a submission.
 */
export const DebloatRow: React.FC<DebloatRowProps> = ({
  pkg,
  selected,
  onToggle,
  disabled = false,
  result,
}) => {
  const { t } = useTranslation();
  const labelKey = `debloat.package.${pkg.id}`;

  return (
    <div
      data-cy={`debloat-row-${pkg.id}`}
      className="flex flex-col gap-3 border-b border-borderColor/50 px-5 py-4 last:border-none sm:flex-row sm:items-center sm:justify-between"
    >
      <label className="flex flex-1 items-start gap-3">
        <input
          type="checkbox"
          data-cy={`debloat-select-${pkg.id}`}
          checked={selected}
          disabled={disabled || !pkg.installed}
          onChange={() => onToggle(pkg.id)}
          aria-label={t(`${labelKey}.title`)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <span>
          <span className="text-sm font-bold text-textMain">{t(`${labelKey}.title`)}</span>
          <span className="mt-1 block text-xs leading-relaxed text-textMuted">
            {t(`${labelKey}.desc`)}
          </span>
          {/* Rendered from the host's invariant caveat token, never from the description: the
              sentence that says how the app comes back must not depend on which language the
              description happened to be written in. */}
          <span
            data-cy={`debloat-caveat-${pkg.id}`}
            className="mt-1 flex items-center gap-1.5 text-xs text-info"
          >
            <Icon name="info" className="h-3.5 w-3.5" /> {t(`debloat.caveat.${pkg.caveat}`)}
          </span>
        </span>
      </label>

      <div className="flex shrink-0 items-center gap-3 sm:justify-end">
        {result && (
          <span data-cy={`debloat-result-${pkg.id}`}>
            <Badge
              text={t(result.ok ? 'debloat.result.removed' : 'debloat.result.failed')}
              variant={result.ok ? 'success' : 'danger'}
            />
          </span>
        )}
        <span data-cy={`debloat-state-${pkg.id}`}>
          <Badge
            text={t(pkg.installed ? 'debloat.state.installed' : 'debloat.state.absent')}
            variant={pkg.installed ? 'info' : 'success'}
          />
        </span>
      </div>
    </div>
  );
};
