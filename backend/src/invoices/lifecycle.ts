import { InvoiceStatus, type Prisma } from '@prisma/client';
import { startOfToday } from '../common/dates';

/** What a client sees. Everything the database stores, plus the derived one. */
export const VISIBLE_STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const;
export type VisibleStatus = (typeof VISIBLE_STATUSES)[number];

export function isVisibleStatus(value: unknown): value is VisibleStatus {
  return VISIBLE_STATUSES.includes(value as VisibleStatus);
}

/**
 * The rule, straight from the brief:
 *
 *   status != "Paid" AND dueDate < today  ->  Overdue
 *   otherwise                             ->  the stored status
 *
 * Note this catches drafts as well as pending invoices. Arguably a draft was
 * never issued so nothing can be late, but the brief is unambiguous and it is
 * implemented as written. Flagged in the README.
 */
export function effectiveStatus(
  stored: InvoiceStatus,
  dueDate: Date,
  now: Date = new Date(),
): VisibleStatus {
  if (stored !== InvoiceStatus.Paid && dueDate < startOfToday(now)) {
    return 'Overdue';
  }

  return stored;
}

/**
 * The same rule as a query predicate, so the filter always agrees with the
 * label each row ends up showing.
 *
 * A pending invoice that is past due shows as Overdue, so it must not come back
 * under ?status=Pending — otherwise the list contradicts itself. Expressing this
 * as plain column comparisons rather than a CASE keeps the (status, due_date)
 * index usable.
 */
export function statusFilter(
  status: VisibleStatus,
  now: Date = new Date(),
): Prisma.InvoiceWhereInput {
  const today = startOfToday(now);

  if (status === 'Overdue') {
    return { status: { not: InvoiceStatus.Paid }, dueDate: { lt: today } };
  }

  if (status === 'Paid') {
    return { status: InvoiceStatus.Paid };
  }

  // Draft and Pending are only themselves while still within terms.
  return { status: InvoiceStatus[status], dueDate: { gte: today } };
}
