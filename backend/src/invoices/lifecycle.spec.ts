import { InvoiceStatus } from '@prisma/client';
import { effectiveStatus, isVisibleStatus, statusFilter } from './lifecycle';

const now = new Date('2026-06-15T09:30:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('effectiveStatus', () => {
  describe('past the due date', () => {
    it.each([InvoiceStatus.Draft, InvoiceStatus.Pending])('reports %s as Overdue', (stored) => {
      expect(effectiveStatus(stored, day('2026-06-14'), now)).toBe('Overdue');
    });

    it('leaves Paid alone however old the invoice is', () => {
      expect(effectiveStatus(InvoiceStatus.Paid, day('2019-01-01'), now)).toBe('Paid');
    });
  });

  describe('within terms', () => {
    it.each([InvoiceStatus.Draft, InvoiceStatus.Pending, InvoiceStatus.Paid])(
      'keeps %s as it is stored',
      (stored) => {
        expect(effectiveStatus(stored, day('2026-12-31'), now)).toBe(stored);
      },
    );

    it('treats the due date itself as still in time', () => {
      expect(effectiveStatus(InvoiceStatus.Pending, day('2026-06-15'), now)).toBe('Pending');
    });
  });

  it('flips over at midnight UTC', () => {
    const due = day('2026-06-15');

    expect(
      effectiveStatus(InvoiceStatus.Pending, due, new Date('2026-06-15T23:59:59.999Z')),
    ).toBe('Pending');
    expect(
      effectiveStatus(InvoiceStatus.Pending, due, new Date('2026-06-16T00:00:00.000Z')),
    ).toBe('Overdue');
  });
});

describe('statusFilter', () => {
  const today = day('2026-06-15');

  it('turns Overdue into "unpaid and past due"', () => {
    expect(statusFilter('Overdue', now)).toEqual({
      status: { not: InvoiceStatus.Paid },
      dueDate: { lt: today },
    });
  });

  it('does not reinterpret Paid by date', () => {
    expect(statusFilter('Paid', now)).toEqual({ status: InvoiceStatus.Paid });
  });

  it.each(['Draft', 'Pending'] as const)(
    'keeps past-due rows out of the %s filter',
    (status) => {
      // Otherwise the row would appear under Pending while rendering as Overdue.
      expect(statusFilter(status, now)).toEqual({
        status: InvoiceStatus[status],
        dueDate: { gte: today },
      });
    },
  );

  it('never selects a row under two different statuses', () => {
    // Draft/Pending require dueDate >= today, Overdue requires dueDate < today,
    // and Paid is excluded from Overdue. The four filters partition the table.
    const overdue = statusFilter('Overdue', now);
    const pending = statusFilter('Pending', now);

    expect(overdue.dueDate).toEqual({ lt: today });
    expect(pending.dueDate).toEqual({ gte: today });
  });
});

describe('isVisibleStatus', () => {
  it.each(['Draft', 'Pending', 'Paid', 'Overdue'])('accepts %s', (value) => {
    expect(isVisibleStatus(value)).toBe(true);
  });

  it.each(['overdue', 'Cancelled', '', null, 7])('rejects %p', (value) => {
    expect(isVisibleStatus(value)).toBe(false);
  });
});
