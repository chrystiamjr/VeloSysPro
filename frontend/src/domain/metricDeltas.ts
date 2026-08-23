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
 * The two rows a batch wrote, or null when the newest pair cannot be vouched for.
 *
 * The panel needs the last comparison to survive closing the app, and the history is where it
 * survives. But "the last two rows" is only a batch if a batch wrote both of them: a batch
 * measures itself twice inside one boot session, seconds apart. Two rows from different sessions
 * are two unrelated readings, and presenting them as a before/after turns weeks of ordinary drift
 * into a claimed result — which is exactly what shipped in v0.4.1.
 */
export function resolveBatchComparison(
  history: readonly OptimizationSnapshot[]
): SnapshotCapturedPayload | null {
  if (history.length < 2) return null;

  const before = history[history.length - 2];
  const after = history[history.length - 1];
  if (before.lastBootUpTime !== after.lastBootUpTime) return null;

  return { before, after, changes: [] };
}

/**
 * The comparison for metrics that cannot move until the machine reboots.
 *
 * A batch measures itself twice, seconds apart, in one boot session — so boot duration is
 * identical on both sides by construction, and the panel says "restart to measure". That hint only
 * resolves against a reading taken after the machine came back up, which is the measurement this
 * app takes on every launch.
 *
 * The `before` side stays anchored to the batch: comparing the current reading against the
 * post-batch one instead would, one restart later, put two post-change boots side by side and
 * call the difference a result.
 *
 * A missing boot identity (rows written before `lastBootUpTime` existed carry `""`) is not
 * evidence either way, so it yields no comparison rather than a guess.
 */
export function resolveNextBootComparison(
  batch: SnapshotCapturedPayload | null,
  current: OptimizationSnapshot | null
): SnapshotCapturedPayload | null {
  if (!batch?.before || !current) return null;

  const batchSession = batch.before.lastBootUpTime;
  if (batchSession === '' || current.lastBootUpTime === '') return null;
  if (current.lastBootUpTime === batchSession) return null;

  return { before: batch.before, after: current, changes: [] };
}
