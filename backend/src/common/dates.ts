// Calendar-date helpers.
//
// `invoiceDate` and `dueDate` are dates, not instants. Postgres stores them as
// `date`; Prisma hands them back as a Date pinned to UTC midnight. Everything
// here works in UTC so the API, the SQL and the tests agree on what "today" is.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` for a Date, reading the UTC fields. */
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Parses `YYYY-MM-DD` into UTC midnight. Returns null if it is not a real date. */
export function fromIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  // Catches 2026-02-30, which matches the pattern but rolls over to 2 March.
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== value) return null;

  return parsed;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && fromIsoDate(value) !== null;
}

/** Today at UTC midnight — the boundary an invoice becomes overdue on. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
