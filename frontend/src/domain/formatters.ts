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

export function formatBytes(value: number, language: AppLanguage): string {
  const kilobytes = Number.isFinite(value) && value >= 0 ? value / 1024 : 0;
  const formatted = new Intl.NumberFormat(localeByLanguage[language], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(kilobytes);
  return `${formatted} KB`;
}
