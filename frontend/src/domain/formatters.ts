export type AppLanguage = 'pt_BR' | 'en_US';

const localeByLanguage: Record<AppLanguage, string> = {
  pt_BR: 'pt-BR',
  en_US: 'en-US',
};

export function timestampValue(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatDateTime(value: string, language: AppLanguage): string {
  const timestamp = timestampValue(value);
  if (timestamp === 0) return '';

  return new Intl.DateTimeFormat(localeByLanguage[language], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

/** Milliseconds as seconds, for the boot duration the host reads from the Windows event log. */
export function formatDuration(milliseconds: number, language: AppLanguage): string {
  const seconds = Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds / 1000 : 0;
  const formatted = new Intl.NumberFormat(localeByLanguage[language], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(seconds);
  return `${formatted} s`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Scales to the largest unit that keeps the number readable, so a registry backup reads as
 * "39,0 KB" and free memory as "8,0 GB" rather than "8.388.608,0 KB".
 *
 * Binary steps (1024), matching how Windows itself reports these figures — a value the user is
 * about to compare against Explorer or Task Manager must not use a different convention.
 */
export function formatBytes(value: number, language: AppLanguage): string {
  let size = Number.isFinite(value) && value > 0 ? value : 0;
  let unit = 0;

  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const formatted = new Intl.NumberFormat(localeByLanguage[language], {
    // Whole bytes have no meaningful fraction; every scaled unit reads better with one.
    minimumFractionDigits: unit === 0 ? 0 : 1,
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(size);

  return `${formatted} ${BYTE_UNITS[unit]}`;
}
