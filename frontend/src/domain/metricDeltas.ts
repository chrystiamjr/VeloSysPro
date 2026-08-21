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

/**
 * The comparison for metrics that cannot move until the machine reboots.
 *
 * A batch measures itself twice, seconds apart, in one boot session — so boot duration is
 * identical on both sides by construction, and the panel says "restart to measure". That hint only
 * resolves if something measures again *after* the reboot, against the state from before the
 * change.
 *
 * The `after` side is therefore the newest measurement on record, accepted only when it comes from
 * a different boot session than the batch. The `before` side stays anchored to the batch's own
 * before: pairing the last two rows instead would, one reboot later, compare two post-change boots
 * against each other and call the noise a result.
 *
 * A missing boot identity (rows written before `lastBootUpTime` existed carry `""`) is not
 * evidence either way, so it yields no comparison rather than a guess.
 */
export function resolveNextBootComparison(
  batch: SnapshotCapturedPayload | null,
  history: readonly OptimizationSnapshot[]
): SnapshotCapturedPayload | null {
  if (!batch?.before || history.length === 0) return null;

  const batchSession = batch.before.lastBootUpTime;
  const newest = history[history.length - 1];
  if (batchSession === '' || newest.lastBootUpTime === '') return null;
  if (newest.lastBootUpTime === batchSession) return null;

  return { before: batch.before, after: newest, changes: [] };
}
