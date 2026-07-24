/**
 * VeloSys Pro - Scheduling domain constants and task-name decoding.
 *
 * The C# host encodes a whole schedule in the Windows task name
 * (`VeloSysPro_Quick_Daily_0300`, `VeloSysPro_Gaming_Weekly_MON_0430`,
 * `VeloSysPro_Full_Monthly_15_0200`), so the Task Scheduler stays the single source of truth
 * and the UI can describe a task without any extra host round-trip.
 */

export type Translate = (key: string, params?: Record<string, unknown> | unknown[]) => string;

const PREFIX = 'VeloSysPro_';

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

export interface ParsedTaskName {
  /** 'quick' | 'full' | 'gaming' | 'revert' */
  type?: string;
  /** 'DAILY' | 'WEEKLY' | 'MONTHLY' */
  frequency?: string;
  /** 'MON'..'SUN' for weekly, '1'..'31' for monthly. */
  day?: string;
  /** 'HH:mm' */
  time?: string;
}

/**
 * Decodes a Windows task name back into its schedule.
 * Legacy names created before schedules were encoded (`VeloSysPro_Quick`) still yield a type,
 * and anything unrecognized yields an empty result so the caller can fall back to the raw name.
 */
export function parseTaskName(name: string): ParsedTaskName {
  if (!name?.startsWith(PREFIX)) return {};

  const parts = name.slice(PREFIX.length).split('_').filter(Boolean);
  const parsed: ParsedTaskName = {};

  const type = parts[0]?.toLowerCase();
  if (OPT_TYPES.some((o) => o.value === type)) parsed.type = type;

  const frequency = parts[1]?.toUpperCase();
  if (FREQUENCIES.some((f) => f.value === frequency)) parsed.frequency = frequency;
  if (!parsed.frequency) return parsed;

  const tail = parts.slice(2);
  const last = tail[tail.length - 1];
  if (last && /^\d{4}$/.test(last)) {
    parsed.time = `${last.slice(0, 2)}:${last.slice(2)}`;
  }

  if (tail.length > 1) {
    const day = tail[0].toUpperCase();
    const validWeekday = parsed.frequency === 'WEEKLY' && WEEKDAYS.some((d) => d.value === day);
    const validMonthDay = parsed.frequency === 'MONTHLY' && MONTH_DAYS.includes(day);
    if (validWeekday || validMonthDay) parsed.day = day;
  }

  return parsed;
}

/** Human label for a task, e.g. "Diária - Otimização Rápida". Falls back to the raw name. */
export function taskDisplayName(name: string, t: Translate): string {
  const { type, frequency } = parseTaskName(name);

  const typeLabel = OPT_TYPES.find((o) => o.value === type)?.labelKey;
  const frequencyLabel = FREQUENCIES.find((f) => f.value === frequency)?.labelKey;

  if (typeLabel && frequencyLabel) {
    return t('scheduling.taskLabel', {
      frequency: t(frequencyLabel),
      optimization: t(typeLabel),
    });
  }

  return typeLabel ? t(typeLabel) : name;
}

/** Concrete cadence for a task, e.g. "Toda segunda-feira às 04:30". */
export function describeSchedule(name: string, t: Translate): string {
  const { frequency, day, time } = parseTaskName(name);
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
