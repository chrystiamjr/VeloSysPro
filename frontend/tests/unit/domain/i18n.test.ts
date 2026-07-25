import { describe, it, expect } from 'vitest';
import { i18n } from '../../../src/domain/i18n';
import pt_BR from '../../../src/domain/locales/pt_BR.json';
import en_US from '../../../src/domain/locales/en_US.json';

function verifyAlphabeticalOrder(obj: Record<string, unknown>, path = ''): void {
  const keys = Object.keys(obj);
  const sortedKeys = [...keys].sort();
  expect(keys, `Keys at path "${path || 'root'}" are not alphabetically sorted`).toEqual(sortedKeys);

  for (const key of keys) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      verifyAlphabeticalOrder(value as Record<string, unknown>, path ? `${path}.${key}` : key);
    }
  }
}

/** Flattens a locale into dot-separated leaf paths, e.g. "scheduling.weekday.mon". */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = String(value);
    }
  }

  return out;
}

/** Interpolation placeholders used by a string, e.g. ["day", "time"]. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
}

const flatPt = flatten(pt_BR as Record<string, unknown>);
const flatEn = flatten(en_US as Record<string, unknown>);

describe('i18n locales', () => {
  it('pt_BR and en_US expose the exact same key set', () => {
    const ptKeys = Object.keys(pt_BR).sort();
    const enKeys = Object.keys(en_US).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('pt_BR and en_US expose the same NESTED key paths', () => {
    // Top-level parity alone lets a nested key (scheduling.weekday.mon, settings.updateTitle,
    // table.range) exist in one locale only, which silently renders the raw key at runtime.
    expect(Object.keys(flatPt).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('keeps interpolation placeholders identical across locales', () => {
    const mismatches = Object.keys(flatPt)
      .filter((key) => key in flatEn)
      .map((key) => ({
        key,
        pt: placeholders(flatPt[key]),
        en: placeholders(flatEn[key]),
      }))
      .filter(({ pt, en }) => pt.join(',') !== en.join(','));

    expect(mismatches).toEqual([]);
  });

  it('has no untranslated leaves left identical to the other locale by accident', () => {
    // A pt_BR value that is byte-identical to en_US is usually an untranslated leak
    // (nav.restorePoints used to read "Restore Points"). Proper nouns are allowlisted.
    const allowed = new Set(['brand.subtitle', 'settings.langEn', 'settings.langPt']);

    const suspicious = Object.keys(flatPt).filter((key) => {
      if (allowed.has(key) || flatPt[key] !== flatEn[key]) return false;
      // Strip placeholders first: pure format strings ("{{frequency}} - {{optimization}}")
      // and passthroughs ("{{text}}") are language neutral, not untranslated.
      const prose = flatPt[key].replace(/\{\{\s*\w+\s*\}\}/g, '');
      return /\p{L}{4,}/u.test(prose);
    });

    expect(suspicious).toEqual([]);
  });

  it('ensures pt_BR JSON keys are sorted alphabetically recursively', () => {
    verifyAlphabeticalOrder(pt_BR as Record<string, unknown>);
  });

  it('ensures en_US JSON keys are sorted alphabetically recursively', () => {
    verifyAlphabeticalOrder(en_US as Record<string, unknown>);
  });

  it('interpolates keyed log messages with {{param}} args', () => {
    i18n.locale('pt_BR');
    const pt = i18n.t('log.backup.created', { file: 'backup_rede_x.reg' });
    expect(pt).toContain('backup_rede_x.reg');
    expect(pt).not.toContain('{{');

    i18n.locale('en_US');
    const en = i18n.t('log.backup.created', { file: 'backup_rede_x.reg' });
    expect(en).toContain('backup_rede_x.reg');
    expect(en).not.toContain('{{');
  });

  it('resolves the raw-passthrough log key', () => {
    i18n.locale('en_US');
    expect(i18n.t('log.raw', { text: 'ipconfig output' })).toBe('ipconfig output');
  });

  it('keeps implementation details out of the user-facing startup log', () => {
    for (const locale of ['pt_BR', 'en_US'] as const) {
      i18n.locale(locale);
      expect(i18n.t('log.appStarted')).not.toMatch(/React|TypeScript|Rosetta/i);
    }
  });
});
