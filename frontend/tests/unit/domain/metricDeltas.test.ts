import { describe, expect, it } from 'vitest';
import {
  IMMEDIATE_METRICS,
  NEXT_BOOT_METRICS,
  formatMetricValue,
  isSameBootSession,
  resolveNextBootComparison,
} from '../../../src/domain/metricDeltas';
import type { OptimizationSnapshot, SnapshotCapturedPayload } from '../../../src/domain/types';

const sampleSnapshot: OptimizationSnapshot = {
  capturedAt: '2026-08-21T00:00:00.000Z',
  bootDurationMs: 15400,
  freeMemoryBytes: 8589934592,
  totalMemoryBytes: 17179869184,
  freeDiskBytes: 107374182400,
  totalDiskBytes: 536870912000,
  automaticServices: 42,
  runningServices: 85,
  startupApps: 6,
  pendingReboot: false,
  lastBootUpTime: '2026-08-20T10:00:00.000Z',
};

const fakeT = (key: string) => `[${key}]`;

describe('metricDeltas', () => {
  it('formats metric values correctly for count, duration, and boolean', () => {
    const autoServices = IMMEDIATE_METRICS.find((m) => m.key === 'automaticServices')!;
    expect(formatMetricValue(autoServices, sampleSnapshot, 'en_US', fakeT).formatted).toBe('42');

    const bootDuration = NEXT_BOOT_METRICS.find((m) => m.key === 'bootDuration')!;
    expect(formatMetricValue(bootDuration, sampleSnapshot, 'en_US', fakeT).formatted).toContain(
      '15.4'
    );

    const pendingReboot = NEXT_BOOT_METRICS.find((m) => m.key === 'pendingReboot')!;
    expect(formatMetricValue(pendingReboot, sampleSnapshot, 'en_US', fakeT).formatted).toBe(
      '[health.no]'
    );
  });

  it('returns notMeasured when source snapshot is null or duration is zero', () => {
    const autoServices = IMMEDIATE_METRICS.find((m) => m.key === 'automaticServices')!;
    expect(formatMetricValue(autoServices, null, 'en_US', fakeT).formatted).toBe(
      '[snapshot.notMeasured]'
    );

    const bootDuration = NEXT_BOOT_METRICS.find((m) => m.key === 'bootDuration')!;
    const zeroBoot = { ...sampleSnapshot, bootDurationMs: 0 };
    expect(formatMetricValue(bootDuration, zeroBoot, 'en_US', fakeT).formatted).toBe(
      '[snapshot.notMeasured]'
    );
  });

  it('identifies same boot session across before and after snapshots', () => {
    const payload: SnapshotCapturedPayload = {
      before: sampleSnapshot,
      after: { ...sampleSnapshot, automaticServices: 40 },
      changes: [],
    };
    expect(isSameBootSession(payload)).toBe(true);

    const differentBoot: SnapshotCapturedPayload = {
      before: sampleSnapshot,
      after: { ...sampleSnapshot, lastBootUpTime: '2026-08-21T01:00:00.000Z' },
      changes: [],
    };
    expect(isSameBootSession(differentBoot)).toBe(false);
  });
});

describe('resolveNextBootComparison', () => {
  const inSession = (boot: string, bootDurationMs: number): OptimizationSnapshot => ({
    ...sampleSnapshot,
    lastBootUpTime: boot,
    bootDurationMs,
  });

  const bootX = '2026-08-20T10:00:00.000Z';
  const bootY = '2026-08-21T09:00:00.000Z';
  const bootZ = '2026-08-22T09:00:00.000Z';

  const batchIn = (boot: string, before: number, after: number): SnapshotCapturedPayload => ({
    before: inSession(boot, before),
    after: inSession(boot, after),
    changes: [],
  });

  it('has nothing to compare while the machine has not rebooted', () => {
    // The batch measured itself twice seconds apart. Boot duration provably cannot have moved,
    // which is what the "restart to measure" hint is for.
    const batch = batchIn(bootX, 15400, 15400);

    expect(resolveNextBootComparison(batch, [batch.before!, batch.after])).toBeNull();
  });

  it('compares the batch against the first measurement from a later boot', () => {
    const batch = batchIn(bootX, 15400, 15400);
    const afterReboot = inSession(bootY, 11200);

    const pair = resolveNextBootComparison(batch, [batch.before!, batch.after, afterReboot]);

    // Anchored to what the machine looked like *before* the change, not to the post-batch
    // measurement — that one was taken in the same boot and carries the same old number.
    expect(pair?.before?.bootDurationMs).toBe(15400);
    expect(pair?.after.bootDurationMs).toBe(11200);
  });

  it('stays anchored to the batch across further reboots', () => {
    // Two reboots later the newest row is a different session again. The comparison must still be
    // "before the change vs now", never "the last two boots", which would drift into noise.
    const batch = batchIn(bootX, 15400, 15400);
    const history = [batch.before!, batch.after, inSession(bootY, 11200), inSession(bootZ, 10900)];

    const pair = resolveNextBootComparison(batch, history);

    expect(pair?.before?.bootDurationMs).toBe(15400);
    expect(pair?.after.bootDurationMs).toBe(10900);
  });

  it('ignores older sessions that precede the batch', () => {
    // A row from before the batch is also "a different session", but using it as the *after* side
    // would run the comparison backwards.
    const batch = batchIn(bootY, 15400, 15400);
    const history = [inSession(bootX, 20000), batch.before!, batch.after];

    expect(resolveNextBootComparison(batch, history)).toBeNull();
  });

  it('refuses to compare when a boot identity is missing', () => {
    // Rows written before lastBootUpTime existed carry "". Two empty strings are not evidence of
    // the same boot, and an empty against a real one is not evidence of a different one.
    const batch = batchIn('', 15400, 15400);

    expect(resolveNextBootComparison(batch, [batch.before!, batch.after, inSession('', 11200)]))
      .toBeNull();
    expect(resolveNextBootComparison(batch, [batch.before!, batch.after, inSession(bootY, 11200)]))
      .toBeNull();
  });

  it('has nothing to compare without a batch or without history', () => {
    expect(resolveNextBootComparison(null, [inSession(bootY, 11200)])).toBeNull();
    expect(resolveNextBootComparison(batchIn(bootX, 15400, 15400), [])).toBeNull();
  });
});
