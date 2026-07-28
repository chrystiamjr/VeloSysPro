import { beforeEach, describe, expect, it } from 'vitest';
import type { ScheduledTaskItem } from '../../../src/domain/types';
import { i18n } from '../../../src/domain/i18n';
import {
  describeSchedule,
  describeTaskState,
  taskDisplayName,
} from '../../../src/domain/scheduling';

const t = (key: string, params?: Record<string, unknown> | unknown[]) => i18n.t(key, params) || key;

const task = (overrides: Partial<ScheduledTaskItem> = {}): ScheduledTaskItem => ({
  Name: 'VeloSysPro_Quick_Daily_0300',
  State: 'Ready',
  Path: '\\VeloSysPro_Quick_Daily_0300',
  Type: 'quick',
  Frequency: 'DAILY',
  Day: '',
  Time: '03:00',
  ...overrides,
});

describe('structured schedule display (pt_BR)', () => {
  beforeEach(() => {
    i18n.locale('pt_BR');
  });

  it('labels a task from structured host fields', () => {
    expect(taskDisplayName(task(), t)).toBe('Diária - Limpeza Rápida');
    expect(
      taskDisplayName(task({ Type: 'gaming', Frequency: 'WEEKLY' }), t)
    ).toBe('Semanal - Predefinição Gaming');
  });

  it('falls back safely for a legacy record', () => {
    const legacy = task({
      Name: 'VeloSysPro_Quick',
      Frequency: '',
      Time: '',
    });
    expect(taskDisplayName(legacy, t)).toBe('Limpeza Rápida');
    expect(describeSchedule(legacy, t)).toBe('—');
  });

  it('describes daily, weekly and monthly cadences', () => {
    expect(describeSchedule(task(), t)).toBe('Todos os dias às 03:00');
    expect(
      describeSchedule(
        task({ Frequency: 'WEEKLY', Day: 'MON', Time: '04:30' }),
        t
      )
    ).toBe('Toda segunda-feira às 04:30');
    expect(
      describeSchedule(
        task({ Frequency: 'MONTHLY', Day: '15', Time: '02:00' }),
        t
      )
    ).toBe('Todo dia 15 às 02:00');
  });
});

describe('describeTaskState', () => {
  beforeEach(() => {
    i18n.locale('pt_BR');
  });

  it('maps locale-neutral Windows state names', () => {
    expect(describeTaskState('Ready', t)).toEqual({ label: 'Pronto', variant: 'success' });
    expect(describeTaskState('Running', t)).toEqual({
      label: 'Em execução',
      variant: 'warning',
    });
    expect(describeTaskState('Disabled', t)).toEqual({
      label: 'Desativada',
      variant: 'danger',
    });
  });

  it('falls back for unknown or localized states', () => {
    expect(describeTaskState('Pronto', t)).toEqual({
      label: 'Desconhecido',
      variant: 'info',
    });
  });
});
