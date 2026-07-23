import { describe, it, expect } from 'vitest';
import { i18n } from '../../../src/domain/i18n';
import pt_BR from '../../../src/domain/locales/pt_BR.json';
import en_US from '../../../src/domain/locales/en_US.json';

describe('i18n locales', () => {
  it('pt_BR and en_US expose the exact same key set', () => {
    const ptKeys = Object.keys(pt_BR).sort();
    const enKeys = Object.keys(en_US).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('interpolates keyed log messages with {{param}} args', () => {
    i18n.locale('pt_BR');
    const pt = i18n.t('logBackupCreated', { file: 'backup_rede_x.reg' });
    expect(pt).toContain('backup_rede_x.reg');
    expect(pt).not.toContain('{{');

    i18n.locale('en_US');
    const en = i18n.t('logBackupCreated', { file: 'backup_rede_x.reg' });
    expect(en).toContain('backup_rede_x.reg');
    expect(en).not.toContain('{{');
  });

  it('resolves the raw-passthrough log key', () => {
    i18n.locale('en_US');
    expect(i18n.t('logRaw', { text: 'ipconfig output' })).toBe('ipconfig output');
  });
});
