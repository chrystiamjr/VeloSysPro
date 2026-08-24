import { describe, expect, it } from 'vitest';
import {
  IMMEDIATE_METRICS,
  NEXT_BOOT_METRICS,
  formatMetricValue,
  isSameBootSession,
  resolveBatchComparison,
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

  const batchIn = (boot: string, before: number, after: number): SnapshotCapturedPayload => ({
    before: inSession(boot, before),
    after: inSession(boot, after),
    changes: [],
  });

  it('has nothing to compare while the machine has not rebooted', () => {
    // The current reading comes from the same boot as the batch, so boot duration provably has
    // not moved — which is what the "restart to measure" hint is for.
    const batch = batchIn(bootX, 15400, 15400);

    expect(resolveNextBootComparison(batch, inSession(bootX, 15400))).toBeNull();
  });

  it('compares the batch against a reading from a later boot', () => {
    const batch = batchIn(bootX, 15400, 15400);

    const pair = resolveNextBootComparison(batch, inSession(bootY, 11200));

    // Anchored to the state before the change, not to the post-batch reading, which was taken in
    // the same boot and carries the same old number.
    expect(pair?.before?.bootDurationMs).toBe(15400);
    expect(pair?.after.bootDurationMs).toBe(11200);
  });

  it('refuses to compare when a boot identity is missing', () => {
    // Rows written before lastBootUpTime existed carry "". Two empty strings are not evidence of
    // the same boot, and an empty against a real one is not evidence of a different one.
    expect(resolveNextBootComparison(batchIn('', 15400, 15400), inSession('', 11200))).toBeNull();
    expect(resolveNextBootComparison(batchIn('', 15400, 15400), inSession(bootY, 11200))).toBeNull();
    expect(resolveNextBootComparison(batchIn(bootX, 15400, 15400), inSession('', 11200))).toBeNull();
  });

  it('has nothing to compare without a batch or without a current reading', () => {
    expect(resolveNextBootComparison(null, inSession(bootY, 11200))).toBeNull();
    expect(resolveNextBootComparison(batchIn(bootX, 15400, 15400), null)).toBeNull();
  });
});

describe('resolveBatchComparison', () => {
  const at = (capturedAt: string, boot: string, automaticServices: number): OptimizationSnapshot => ({
    ...sampleSnapshot,
    capturedAt,
    lastBootUpTime: boot,
    automaticServices,
  });

  const bootX = '2026-08-20T10:00:00.000Z';
  const bootY = '2026-08-23T18:00:00.000Z';

  it('pairs the two rows a batch wrote', () => {
    const history = [at('2026-08-20T11:00:00.000Z', bootX, 86), at('2026-08-20T11:02:00.000Z', bootX, 82)];

    const pair = resolveBatchComparison(history);

    expect(pair?.before?.automaticServices).toBe(86);
    expect(pair?.after.automaticServices).toBe(82);
  });

  it('refuses to pair readings from different boot sessions', () => {
    // The regression this guards: a standalone reading persisted a month later became the second
    // half of an old batch's comparison, and 27 days of drift were shown as an optimization
    // result. A batch measures itself twice inside one boot; anything else is not a batch.
    const history = [at('2026-07-27T14:57:42.000Z', bootX, 86), at('2026-08-23T19:19:31.000Z', bootY, 82)];

    expect(resolveBatchComparison(history)).toBeNull();
  });

  it('needs two rows before it can pair anything', () => {
    expect(resolveBatchComparison([])).toBeNull();
    expect(resolveBatchComparison([at('2026-08-20T11:00:00.000Z', bootX, 86)])).toBeNull();
  });
});
