import { describe, it, expect } from 'vitest';
import { parseDisplayDate, parseDisplayNumber } from '../../../src/domain/formatters';

describe('parseDisplayDate', () => {
  it('orders dates chronologically where a lexicographic sort would not', () => {
    const older = parseDisplayDate('31/12/2025 23:00');
    const newer = parseDisplayDate('01/01/2026 00:00');

    expect(older).toBeLessThan(newer);
    // Guards the actual bug: sorting the raw display strings puts "31/12" after "01/01".
    expect('31/12/2025 23:00' < '01/01/2026 00:00').toBe(false);
  });

  it('distinguishes times within the same day', () => {
    expect(parseDisplayDate('23/07/2026 03:15')).toBeLessThan(parseDisplayDate('23/07/2026 17:07'));
  });

  it('accepts a date without a time component', () => {
    expect(parseDisplayDate('23/07/2026')).toBe(new Date(2026, 6, 23, 0, 0).getTime());
  });

  it('returns 0 for empty or malformed values instead of NaN', () => {
    expect(parseDisplayDate('')).toBe(0);
    expect(parseDisplayDate('N/A')).toBe(0);
    expect(parseDisplayDate('2026-07-23T03:15')).toBe(0);
  });
});

describe('parseDisplayNumber', () => {
  it('parses en-US grouped sizes', () => {
    expect(parseDisplayNumber('1,234.5 KB')).toBe(1234.5);
  });

  it('parses pt-BR grouped sizes', () => {
    expect(parseDisplayNumber('1.234,5 KB')).toBe(1234.5);
  });

  it('parses ungrouped sizes in both cultures', () => {
    expect(parseDisplayNumber('45.6 KB')).toBe(45.6);
    expect(parseDisplayNumber('45,6 KB')).toBe(45.6);
  });

  it('orders a grouped size above an ungrouped one', () => {
    expect(parseDisplayNumber('1.234,5 KB')).toBeGreaterThan(parseDisplayNumber('999,9 KB'));
  });

  it('returns 0 for empty or non-numeric values', () => {
    expect(parseDisplayNumber('')).toBe(0);
    expect(parseDisplayNumber('unknown')).toBe(0);
  });
});
