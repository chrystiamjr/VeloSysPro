import { describe, expect, it } from 'vitest';
import { formatBytes, formatDateTime, timestampValue } from '../../../src/domain/formatters';

describe('locale-neutral management record formatting', () => {
  it('orders ISO timestamps directly as comparable values', () => {
    expect(timestampValue('2025-12-31T23:00:00.000Z')).toBeLessThan(
      timestampValue('2026-01-01T00:00:00.000Z')
    );
  });

  it('returns zero for an invalid timestamp', () => {
    expect(timestampValue('not-a-date')).toBe(0);
  });

  it('formats the same timestamp for the selected application language', () => {
    const timestamp = '2026-07-23T06:15:00.000Z';

    expect(formatDateTime(timestamp, 'pt_BR')).toMatch(/23\/07\/2026/);
    expect(formatDateTime(timestamp, 'en_US')).toMatch(/07\/23\/2026/);
  });

  it('formats byte counts at the rendering edge', () => {
    expect(formatBytes(39936, 'pt_BR')).toBe('39,0 KB');
    expect(formatBytes(39936, 'en_US')).toBe('39.0 KB');
  });
});
