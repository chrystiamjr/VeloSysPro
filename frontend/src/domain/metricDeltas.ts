import type { OptimizationSnapshot, SnapshotCapturedPayload } from './types';
import { AppLanguage, formatBytes, formatDuration } from './formatters';

export type MetricFormat = 'bytes' | 'duration' | 'count' | 'boolean';

export interface MetricDefinition {
  key: string;
  format: MetricFormat;
  read: (snapshot: OptimizationSnapshot) => number | boolean;
}

export const IMMEDIATE_METRICS: readonly MetricDefinition[] = [
  { key: 'automaticServices', format: 'count', read: (s) => s.automaticServices },
  { key: 'runningServices', format: 'count', read: (s) => s.runningServices },
  { key: 'startupApps', format: 'count', read: (s) => s.startupApps },
];

export const NEXT_BOOT_METRICS: readonly MetricDefinition[] = [
  { key: 'bootDuration', format: 'duration', read: (s) => s.bootDurationMs },
  { key: 'pendingReboot', format: 'boolean', read: (s) => s.pendingReboot },
];

export interface FormattedMetricValue {
  raw: number | boolean | null;
  formatted: string;
}

export function formatMetricValue(
  metric: MetricDefinition,
  source: OptimizationSnapshot | null,
  lang: AppLanguage,
  t: (key: string) => string
): FormattedMetricValue {
  if (!source) return { raw: null, formatted: t('snapshot.notMeasured') };

  const value = metric.read(source);
  if (typeof value === 'boolean') {
    return { raw: value, formatted: value ? t('health.yes') : t('health.no') };
  }
  if (metric.format === 'bytes') {
    return { raw: value, formatted: formatBytes(value, lang) };
  }
  if (metric.format === 'duration') {
    return {
      raw: value,
      formatted: value === 0 ? t('snapshot.notMeasured') : formatDuration(value, lang),
    };
  }
  return { raw: value, formatted: String(value) };
}

export function isSameBootSession(snapshot: SnapshotCapturedPayload | null): boolean {
  return (
    !!snapshot &&
    snapshot.before !== null &&
    snapshot.before.lastBootUpTime === snapshot.after.lastBootUpTime
  );
}
