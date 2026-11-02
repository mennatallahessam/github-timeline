const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Formats an ISO timestamp as e.g. "March 14, 2023".
 * UTC is used deliberately so the printed date always agrees with the year
 * marker it sits under, regardless of the viewer's timezone.
 */
export function formatDate(iso: string, locale = 'en-US'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

/** UTC year of an ISO timestamp (kept consistent with {@link formatDate}). */
export function getYear(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

/** Local wall-clock time, e.g. "3:42 PM", used for the rate-limit reset message. */
export function formatTime(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}
