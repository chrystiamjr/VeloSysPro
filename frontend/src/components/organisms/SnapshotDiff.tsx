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

const METRICS: MetricRow[] = [
  { key: 'bootDuration', format: 'duration', read: (s) => s.bootDurationMs },
  { key: 'freeMemory', format: 'bytes', read: (s) => s.freeMemoryBytes },
  { key: 'freeDisk', format: 'bytes', read: (s) => s.freeDiskBytes },
  { key: 'automaticServices', format: 'count', read: (s) => s.automaticServices },
  { key: 'runningServices', format: 'count', read: (s) => s.runningServices },
  { key: 'startupApps', format: 'count', read: (s) => s.startupApps },
  { key: 'pendingReboot', format: 'boolean', read: (s) => s.pendingReboot },
];

/**
 * The before/after table that shows what a batch actually changed, measured with built-in Windows
 * facilities rather than a third-party benchmark (docs/adr/0006-built-in-only-boundary.md).
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

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <h3 className="text-lg font-bold text-white">{t('snapshot.sectionTitle')}</h3>
        <p className="mt-1 text-xs text-textMuted">{t('snapshot.sectionDesc')}</p>
      </div>

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
              {METRICS.map((metric) => (
                <tr
                  key={metric.key}
                  data-cy={`snapshot-metric-${metric.key}`}
                  className="border-b border-borderColor/50 last:border-none"
                >
                  <td className="px-5 py-3 text-textMuted">{t(`snapshot.metric.${metric.key}`)}</td>
                  <td className="px-5 py-3 text-right text-textMuted">
                    {render(metric, snapshot.before)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-textMain">
                    {render(metric, snapshot.after)}
                  </td>
                </tr>
              ))}
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
