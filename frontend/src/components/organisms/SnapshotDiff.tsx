import type { SnapshotCapturedPayload } from '../../domain/types';
import { formatDateTime } from '../../domain/formatters';
import {
  IMMEDIATE_METRICS,
  NEXT_BOOT_METRICS,
  MetricDefinition,
  formatMetricValue,
} from '../../domain/metricDeltas';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SnapshotDiffProps {
  snapshot: SnapshotCapturedPayload | null;
  /**
   * The cross-boot comparison for metrics that cannot move until the machine restarts, or null
   * while no measurement from a later boot exists yet. Resolved by `resolveNextBootComparison`.
   */
  nextBoot?: SnapshotCapturedPayload | null;
}

/**
 * What a batch did, in two honestly separated halves: the settings it actually moved (read back
 * off the live system, fully attributable) and the system metrics around it (context, which moves
 * for reasons of its own). Measured with built-in Windows facilities only — see
 * docs/adr/0006-built-in-only-boundary.md.
 */
export const SnapshotDiff: React.FC<SnapshotDiffProps> = ({ snapshot, nextBoot = null }) => {
  const { t, lang } = useTranslation();

  // The "before" side is known for every metric — the batch measured it. Only the "after" side of
  // a reboot-dependent metric has to wait, because the machine has to restart before there is
  // anything new to read.
  const afterSourceFor = (groupKey: string) => (groupKey === 'nextBoot' ? nextBoot : snapshot);

  const renderAfter = (
    metric: MetricDefinition,
    source: SnapshotCapturedPayload | null
  ): string => {
    if (!source) {
      return t(
        NEXT_BOOT_METRICS.includes(metric) ? 'snapshot.restartToMeasure' : 'snapshot.notMeasured'
      );
    }
    return formatMetricValue(metric, source.after, lang, t).formatted;
  };

  const metricRows = (rows: readonly MetricDefinition[], groupKey: string) => (
    <>
      <tr className="border-b border-borderColor/50 bg-bgMain/40">
        <th
          colSpan={3}
          className="px-5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-textMuted"
        >
          {t(`snapshot.group.${groupKey}`)}
        </th>
      </tr>
      {rows.map((metric) => (
        <tr
          key={metric.key}
          data-cy={`snapshot-metric-${metric.key}`}
          className="border-b border-borderColor/50 last:border-none"
        >
          <td className="px-5 py-3 text-textMuted">{t(`snapshot.metric.${metric.key}`)}</td>
          <td className="px-5 py-3 text-right text-textMuted">
            {formatMetricValue(metric, snapshot?.before ?? null, lang, t).formatted}
          </td>
          <td className="px-5 py-3 text-right font-semibold text-textMain">
            {renderAfter(metric, afterSourceFor(groupKey))}
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <h3 className="text-lg font-bold text-white">{t('snapshot.sectionTitle')}</h3>
        <p className="mt-1 text-xs text-textMuted">{t('snapshot.sectionDesc')}</p>
      </div>

      {snapshot && snapshot.changes.length > 0 && (
        <div
          data-cy="snapshot-changes"
          className="overflow-x-auto rounded-xl border border-borderColor bg-bgCard"
        >
          <h4 className="border-b border-borderColor px-5 py-3 text-xs font-bold uppercase tracking-wide text-textMuted">
            {t('snapshot.changesTitle')}
          </h4>
          <table className="w-full min-w-[480px] text-left text-xs">
            <tbody>
              {snapshot.changes.map((change) => (
                <tr
                  key={`${change.tweakId}.${change.setting}`}
                  data-cy={`snapshot-change-${change.tweakId}`}
                  className="border-b border-borderColor/50 last:border-none"
                >
                  <td className="px-5 py-3 text-textMuted">
                    {t(`optimize.tweak.${change.tweakId}.title`)}
                    <span className="ml-2 font-mono text-[11px] opacity-60">{change.setting}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-textMuted">
                    {change.before === '' ? t('snapshot.absent') : change.before}
                  </td>
                  <td className="w-8 px-0 py-3 text-center text-textMuted">&rarr;</td>
                  <td className="px-5 py-3 text-left font-mono font-semibold text-success">
                    {change.after === '' ? t('snapshot.absent') : change.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        data-cy="snapshot-diff"
        className="overflow-x-auto rounded-xl border border-borderColor bg-bgCard"
      >
        {!snapshot ? (
          <p className="p-8 text-center text-xs text-textMuted">{t('snapshot.empty')}</p>
        ) : (
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-borderColor text-textMuted">
                <th className="px-5 py-3 font-semibold">{t('snapshot.colMetric')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('snapshot.before')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('snapshot.after')}</th>
              </tr>
            </thead>
            <tbody>
              {metricRows(IMMEDIATE_METRICS, 'immediate')}
              {metricRows(NEXT_BOOT_METRICS, 'nextBoot')}
            </tbody>
          </table>
        )}
      </div>

      {snapshot && (
        <p data-cy="snapshot-captured-at" className="text-right text-[11px] text-textMuted">
          {t('snapshot.capturedAt', {
            timestamp: formatDateTime(snapshot.after.capturedAt, lang),
          })}
        </p>
      )}
    </div>
  );
};
