/**
 * VeloSys Pro - Display value formatters and parsers.
 *
 * The C# host sends dates already formatted for display (`dd/MM/yyyy HH:mm`), so sorting
 * those strings lexicographically is wrong: "31/12/2025 23:00" would sort after
 * "01/01/2026 00:00". These helpers turn display values back into comparable primitives.
 */

const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/;

/**
 * Converts a `dd/MM/yyyy HH:mm` display date into epoch milliseconds for sorting.
 * Returns 0 for empty or unrecognized values so a malformed row never breaks the sort.
 */
export function parseDisplayDate(value: string): number {
  const match = DISPLAY_DATE.exec(value?.trim() ?? '');
  if (!match) return 0;

  const [, day, month, year, hours = '00', minutes = '00'] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/**
 * Converts a culture-formatted numeric display string into a comparable number.
 *
 * The C# host formats sizes with `ToString("N1")`, which follows the machine culture:
 * "1,234.5 KB" on en-US but "1.234,5 KB" on pt-BR. A separator trailed by at most two
 * digits is the decimal separator; every other separator groups thousands.
 * Returns 0 for empty or unparseable values.
 */
export function parseDisplayNumber(value: string): number {
  const raw = (value ?? '').replace(/[^\d.,]/g, '');
  if (raw.length === 0) return 0;

  const lastSeparator = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  const isDecimal = lastSeparator >= 0 && raw.length - lastSeparator - 1 <= 2;
  const decimals = isDecimal ? raw.slice(lastSeparator + 1) : '';
  const integer = (isDecimal ? raw.slice(0, lastSeparator) : raw).replace(/[.,]/g, '');

  const parsed = Number(decimals ? `${integer}.${decimals}` : integer);
  return Number.isFinite(parsed) ? parsed : 0;
}
