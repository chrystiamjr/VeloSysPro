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

describe('i18n locales', () => {
  it('pt_BR and en_US expose the exact same key set', () => {
    const ptKeys = Object.keys(pt_BR).sort();
    const enKeys = Object.keys(en_US).sort();
    expect(ptKeys).toEqual(enKeys);
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
