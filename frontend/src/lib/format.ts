// Display helpers. Kept out of components so an amount reads the same on the
// ledger, the detail sheet and the new-invoice preview, and so the rules can be
// tested without rendering anything.

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Currencies with no minor unit. Everything else gets two decimals. */
const WHOLE_UNIT = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK']);

/**
 * Formats an amount using the symbol the API stored on the invoice.
 *
 * Intl handles the grouping, but its own currency symbols follow the viewer's
 * locale — the same AUD invoice would read "A$" for one person and "AU$" for
 * another. The stored symbol wins so a reprint matches the original.
 */
export function formatMoney(amount: number, symbol: string, currency = 'AUD'): string {
  const decimals = WHOLE_UNIT.has(currency.toUpperCase()) ? 0 : 2;

  const digits = new Intl.NumberFormat('en-AU', {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));

  return `${amount < 0 ? '-' : ''}${symbol}${digits}`;
}

/**
 * `2026-06-03` becomes `3 Jun 2026`.
 *
 * Hand-built rather than going through Intl: the abbreviations Intl produces
 * differ between engines ("Jun" in one, "June" in another), and an invoice
 * should not render differently depending on the browser. Read in UTC, because
 * a calendar date has no time zone and the local getters would shift it a day
 * for anyone west of Greenwich.
 */
export function formatDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A timestamp is a real instant, so it renders in the viewer's own zone. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} at ${time}`;
}

/** "in 6 days" / "12 days late", for the line under a due date. */
export function describeDue(dueDate: string, today = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;

  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(due)) return null;

  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((due - start) / 86_400_000);

  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days === -1) return '1 day late';
  if (days < 0) return `${Math.abs(days)} days late`;

  return `in ${days} days`;
}

/** Today as `YYYY-MM-DD`, for date input defaults. */
export function todayIso(today = new Date()): string {
  return today.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` a number of days from today. */
export function isoPlusDays(days: number, today = new Date()): string {
  const shifted = new Date(today.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
