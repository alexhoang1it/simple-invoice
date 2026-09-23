import { InvoiceStatus } from '@prisma/client';
import { buildWhere } from './invoices.repository';

const now = new Date('2026-06-15T09:30:00.000Z');
const today = new Date('2026-06-15T00:00:00.000Z');

/** Reaches into the AND list the builder produces. */
const clauses = (where: ReturnType<typeof buildWhere>) =>
  (where.AND ?? []) as Record<string, unknown>[];

describe('buildWhere', () => {
  it('is empty when nothing is filtered, so the query matches everything', () => {
    expect(buildWhere({}, now)).toEqual({});
  });

  describe('keyword', () => {
    it('searches invoice number and customer name together', () => {
      const [clause] = clauses(buildWhere({ keyword: 'braddon' }, now));

      expect(clause).toEqual({
        OR: [
          { invoiceNumber: { contains: 'braddon', mode: 'insensitive' } },
          { customer: { fullname: { contains: 'braddon', mode: 'insensitive' } } },
        ],
      });
    });

    it('is case-insensitive on both sides', () => {
      const [clause] = clauses(buildWhere({ keyword: 'BRADDON' }, now));
      const or = (clause as { OR: Record<string, never>[] }).OR;

      expect(JSON.stringify(or)).toContain('"mode":"insensitive"');
    });

    it('is ignored when blank', () => {
      expect(buildWhere({ keyword: '' }, now)).toEqual({});
    });
  });

  describe('status', () => {
    it('expands Overdue into unpaid-and-past-due', () => {
      const [clause] = clauses(buildWhere({ status: 'Overdue' }, now));

      expect(clause).toEqual({ status: { not: InvoiceStatus.Paid }, dueDate: { lt: today } });
    });

    it('leaves Paid alone', () => {
      const [clause] = clauses(buildWhere({ status: 'Paid' }, now));

      expect(clause).toEqual({ status: InvoiceStatus.Paid });
    });

    it('keeps past-due rows out of Pending', () => {
      const [clause] = clauses(buildWhere({ status: 'Pending' }, now));

      expect(clause).toEqual({ status: InvoiceStatus.Pending, dueDate: { gte: today } });
    });
  });

  describe('date range', () => {
    it('applies both bounds to the invoice date', () => {
      const [clause] = clauses(
        buildWhere({ fromDate: '2026-01-01', toDate: '2026-12-31' }, now),
      );

      expect(clause).toEqual({
        invoiceDate: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-12-31T00:00:00.000Z'),
        },
      });
    });

    it('accepts an open-ended range', () => {
      const [lower] = clauses(buildWhere({ fromDate: '2026-01-01' }, now));
      const [upper] = clauses(buildWhere({ toDate: '2026-12-31' }, now));

      expect(lower).toEqual({ invoiceDate: { gte: new Date('2026-01-01T00:00:00.000Z') } });
      expect(upper).toEqual({ invoiceDate: { lte: new Date('2026-12-31T00:00:00.000Z') } });
    });
  });

  it('combines every filter with AND', () => {
    const where = buildWhere(
      { keyword: 'braddon', status: 'Overdue', fromDate: '2026-01-01', toDate: '2026-12-31' },
      now,
    );

    expect(clauses(where)).toHaveLength(3);
  });
});
