import { describe, expect, it } from 'vitest';
import {
  IMMEDIATE_METRICS,
  NEXT_BOOT_METRICS,
  formatMetricValue,
  isSameBootSession,
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
