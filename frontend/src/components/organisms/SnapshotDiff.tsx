import React from 'react';
import type { OptimizationSnapshot, SnapshotCapturedPayload } from '../../domain/types';
import { formatBytes, formatDateTime, formatDuration } from '../../domain/formatters';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SnapshotDiffProps {
  snapshot: SnapshotCapturedPayload | null;
}

type MetricFormat = 'bytes' | 'duration' | 'count' | 'boolean';

interface MetricRow {
  key: string;
  format: MetricFormat;
  read: (snapshot: OptimizationSnapshot) => number | boolean;
}

/**
 * Metrics that can move within the session the batch runs in, so a before/after pair is
 * meaningful. Free memory and free disk are deliberately absent: they drift on their own between
 * the two measurements and none of the Tweaks touch them, so showing them as a "gain" would put
 * noise where the user expects an effect.
 */
const IMMEDIATE_METRICS: MetricRow[] = [
  { key: 'automaticServices', format: 'count', read: (s) => s.automaticServices },
  { key: 'runningServices', format: 'count', read: (s) => s.runningServices },
  { key: 'startupApps', format: 'count', read: (s) => s.startupApps },
];

/**
 * Metrics whose value cannot change until Windows restarts. Boot duration is read from the event
 * log for the *last* boot, so measuring it either side of a batch necessarily reports the same
 * number — presenting that as "no gain" was the misleading part of the first version.
 */
const NEXT_BOOT_METRICS: MetricRow[] = [
  { key: 'bootDuration', format: 'duration', read: (s) => s.bootDurationMs },
  { key: 'pendingReboot', format: 'boolean', read: (s) => s.pendingReboot },
];

/**
 * What a batch did, in two honestly separated halves: the settings it actually moved (read back
 * off the live system, fully attributable) and the system metrics around it (context, which moves
 * for reasons of its own). Measured with built-in Windows facilities only — see
 * docs/adr/0006-built-in-only-boundary.md.
 */
export const SnapshotDiff: React.FC<SnapshotDiffProps> = ({ snapshot }) => {
  const { t, lang } = useTranslation();

  const render = (metric: MetricRow, source: OptimizationSnapshot | null): string => {
    if (!source) return t('snapshot.notMeasured');

    const value = metric.read(source);
    if (typeof value === 'boolean') return value ? t('health.yes') : t('health.no');
    if (metric.format === 'bytes') return formatBytes(value, lang);
    // A boot duration of zero means the Diagnostics-Performance log had nothing to report,
    // which is "not measured", not "instant".
    if (metric.format === 'duration') {
      return value === 0 ? t('snapshot.notMeasured') : formatDuration(value, lang);
    }
    return String(value);
  };

  // A Snapshot pair from one session shares its boot identity, so the boot figure is the same
  // reading twice over. Say "restart to measure" instead of implying nothing improved.
  const sameBootSession =
    !!snapshot &&
    snapshot.before !== null &&
    snapshot.before.lastBootUpTime === snapshot.after.lastBootUpTime;

  const renderAfter = (metric: MetricRow): string => {
    if (!snapshot) return t('snapshot.notMeasured');
    if (metric.key === 'bootDuration' && sameBootSession) return t('snapshot.restartToMeasure');
    return render(metric, snapshot.after);
  };

  const metricRows = (rows: MetricRow[], groupKey: string) => (
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
            {render(metric, snapshot?.before ?? null)}
          </td>
          <td className="px-5 py-3 text-right font-semibold text-textMain">
            {renderAfter(metric)}
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
