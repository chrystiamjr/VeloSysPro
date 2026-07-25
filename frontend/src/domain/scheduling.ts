/**
 * VeloSys Pro scheduling labels for the structured records emitted by the host.
 */
import type { ScheduledTaskItem } from './schemas';

export type Translate = (key: string, params?: Record<string, unknown> | unknown[]) => string;

export const OPT_TYPES = [
  { value: 'quick', labelKey: 'act.quick.title' },
  { value: 'full', labelKey: 'act.full.title' },
  { value: 'gaming', labelKey: 'act.gaming.title' },
  { value: 'revert', labelKey: 'act.revert.title' },
] as const;

export const FREQUENCIES = [
  { value: 'DAILY', labelKey: 'scheduling.freqDaily' },
  { value: 'WEEKLY', labelKey: 'scheduling.freqWeekly' },
  { value: 'MONTHLY', labelKey: 'scheduling.freqMonthly' },
] as const;

export const WEEKDAYS = [
  { value: 'MON', labelKey: 'scheduling.weekday.mon' },
  { value: 'TUE', labelKey: 'scheduling.weekday.tue' },
  { value: 'WED', labelKey: 'scheduling.weekday.wed' },
  { value: 'THU', labelKey: 'scheduling.weekday.thu' },
  { value: 'FRI', labelKey: 'scheduling.weekday.fri' },
  { value: 'SAT', labelKey: 'scheduling.weekday.sat' },
  { value: 'SUN', labelKey: 'scheduling.weekday.sun' },
] as const;

export const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** Human label for a task, e.g. "Diária - Otimização Rápida". Falls back to the raw name. */
export function taskDisplayName(task: ScheduledTaskItem, t: Translate): string {
  const typeLabel = OPT_TYPES.find((o) => o.value === task.Type)?.labelKey;
  const frequencyLabel = FREQUENCIES.find((f) => f.value === task.Frequency)?.labelKey;

  if (typeLabel && frequencyLabel) {
    return t('scheduling.taskLabel', {
      frequency: t(frequencyLabel),
      optimization: t(typeLabel),
    });
  }

  return typeLabel ? t(typeLabel) : task.Name;
}

/** Concrete cadence for a task, e.g. "Toda segunda-feira às 04:30". */
export function describeSchedule(task: ScheduledTaskItem, t: Translate): string {
  const { Frequency: frequency, Day: day, Time: time } = task;
  if (!frequency || !time) return t('scheduling.scheduleUnknown');

  if (frequency === 'WEEKLY') {
    const weekday = WEEKDAYS.find((d) => d.value === day);
    if (!weekday) return t('scheduling.scheduleUnknown');
    return t('scheduling.scheduleWeekly', { day: t(weekday.labelKey), time });
  }

  if (frequency === 'MONTHLY') {
    if (!day) return t('scheduling.scheduleUnknown');
    return t('scheduling.scheduleMonthly', { day, time });
  }

  return t('scheduling.scheduleDaily', { time });
}

const STATE_LABELS: Record<string, { key: string; variant: 'success' | 'warning' | 'danger' }> = {
  ready: { key: 'scheduling.stateReady', variant: 'success' },
  running: { key: 'scheduling.stateRunning', variant: 'warning' },
  queued: { key: 'scheduling.stateRunning', variant: 'warning' },
  disabled: { key: 'scheduling.stateDisabled', variant: 'danger' },
};

/**
 * Maps the Windows task state onto a translated label and a badge variant.
 * `Get-ScheduledTask` reports a .NET enum name, so the keys stay stable across OS languages.
 */
export function describeTaskState(state: string, t: Translate) {
  const entry = STATE_LABELS[state?.trim().toLowerCase()];
  return entry
    ? { label: t(entry.key), variant: entry.variant }
    : { label: t('scheduling.stateUnknown'), variant: 'info' as const };
}
