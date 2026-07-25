import { describe, it, expect, beforeEach } from 'vitest';
import { i18n } from '../../../src/domain/i18n';
import {
  describeSchedule,
  describeTaskState,
  parseTaskName,
  taskDisplayName,
} from '../../../src/domain/scheduling';

const t = (key: string, params?: Record<string, unknown> | unknown[]) => i18n.t(key, params) || key;

describe('parseTaskName', () => {
  it('decodes a daily schedule', () => {
    expect(parseTaskName('VeloSysPro_Quick_Daily_0300')).toEqual({
      type: 'quick',
      frequency: 'DAILY',
      time: '03:00',
    });
  });

  it('decodes a weekly schedule with its weekday', () => {
    expect(parseTaskName('VeloSysPro_Gaming_Weekly_MON_0430')).toEqual({
      type: 'gaming',
      frequency: 'WEEKLY',
      day: 'MON',
      time: '04:30',
    });
  });

  it('decodes a monthly schedule with its day of month', () => {
    expect(parseTaskName('VeloSysPro_Full_Monthly_15_0200')).toEqual({
      type: 'full',
      frequency: 'MONTHLY',
      day: '15',
      time: '02:00',
    });
  });

  it('decodes a legacy two-segment name as type only', () => {
    expect(parseTaskName('VeloSysPro_Quick')).toEqual({ type: 'quick' });
  });

  it('ignores names outside the VeloSys Pro namespace', () => {
    expect(parseTaskName('SomeOtherTask')).toEqual({});
    expect(parseTaskName('')).toEqual({});
  });

  it('drops unrecognized components instead of guessing', () => {
    expect(parseTaskName('VeloSysPro_Bogus_Yearly_9999')).toEqual({});
    expect(parseTaskName('VeloSysPro_Quick_Weekly_XYZ_0300')).toEqual({
      type: 'quick',
      frequency: 'WEEKLY',
      time: '03:00',
    });
  });

  it('distinguishes two schedules of the same optimization', () => {
    const first = parseTaskName('VeloSysPro_Quick_Daily_0300');
    const second = parseTaskName('VeloSysPro_Quick_Daily_0500');

    expect(first.time).toBe('03:00');
    expect(second.time).toBe('05:00');
  });
});

describe('display helpers (pt_BR)', () => {
  beforeEach(() => {
    i18n.locale('pt_BR');
  });

  it('labels a task as frequency plus optimization', () => {
    expect(taskDisplayName('VeloSysPro_Quick_Daily_0300', t)).toBe('Diária - Otimização Rápida');
    expect(taskDisplayName('VeloSysPro_Gaming_Weekly_MON_0430', t)).toBe('Semanal - Modo Gaming');
  });

  it('falls back to the optimization alone for legacy names', () => {
    expect(taskDisplayName('VeloSysPro_Quick', t)).toBe('Otimização Rápida');
  });

  it('falls back to the raw name when nothing can be decoded', () => {
    expect(taskDisplayName('VeloSysPro_Unknown', t)).toBe('VeloSysPro_Unknown');
  });

  it('describes each cadence concretely', () => {
    expect(describeSchedule('VeloSysPro_Quick_Daily_0300', t)).toBe('Todos os dias às 03:00');
    expect(describeSchedule('VeloSysPro_Gaming_Weekly_MON_0430', t)).toBe(
      'Toda segunda-feira às 04:30'
    );
    expect(describeSchedule('VeloSysPro_Full_Monthly_15_0200', t)).toBe('Todo dia 15 às 02:00');
  });

  it('marks an undecodable schedule instead of inventing one', () => {
    expect(describeSchedule('VeloSysPro_Quick', t)).toBe('—');
  });
});

describe('describeTaskState', () => {
  beforeEach(() => {
    i18n.locale('pt_BR');
  });

  it('maps the Get-ScheduledTask enum names', () => {
    expect(describeTaskState('Ready', t)).toEqual({ label: 'Pronto', variant: 'success' });
    expect(describeTaskState('Running', t)).toEqual({ label: 'Em execução', variant: 'warning' });
    expect(describeTaskState('Disabled', t)).toEqual({ label: 'Desativada', variant: 'danger' });
  });

  it('is case and whitespace tolerant', () => {
    expect(describeTaskState('  ready ', t).label).toBe('Pronto');
  });

  it('falls back for states it does not know', () => {
    expect(describeTaskState('Pronto', t)).toEqual({ label: 'Desconhecido', variant: 'info' });
    expect(describeTaskState('', t).label).toBe('Desconhecido');
  });
});
