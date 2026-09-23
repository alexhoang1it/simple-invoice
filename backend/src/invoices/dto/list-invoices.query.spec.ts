import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListInvoicesQuery } from './list-invoices.query';

function check(query: Record<string, unknown>): string[] {
  const dto = plainToInstance(ListInvoicesQuery, query);

  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );
}

const shape = (query: Record<string, unknown>) => plainToInstance(ListInvoicesQuery, query);

describe('ListInvoicesQuery', () => {
  it('accepts an empty query so the service can apply its defaults', () => {
    expect(check({})).toEqual([]);
  });

  it('accepts every parameter at once', () => {
    expect(
      check({
        page: '2',
        pageSize: '25',
        sortBy: 'totalAmount',
        ordering: 'ASC',
        status: 'Overdue',
        keyword: 'braddon',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      }),
    ).toEqual([]);
  });

  describe('paging', () => {
    it('coerces the numeric strings a query string always gives you', () => {
      const dto = shape({ page: '3', pageSize: '25' });

      expect(dto.page).toBe(3);
      expect(dto.pageSize).toBe(25);
    });

    it.each(['0', '-1'])('rejects page %p', (page) => {
      expect(check({ page })).toContain('page must be at least 1');
    });

    it('rejects a fractional page', () => {
      expect(check({ page: '1.5' })).toContain('page must be an integer');
    });

    it('rejects a page that is not a number at all', () => {
      expect(check({ page: 'abc' })).toContain('page must be an integer');
    });

    it('caps the page size at the hard limit', () => {
      expect(check({ pageSize: '101' })).toContain('pageSize cannot exceed 100');
      expect(check({ pageSize: '100' })).toEqual([]);
    });
  });

  describe('sorting', () => {
    it.each(['invoiceDate', 'dueDate', 'totalAmount'])('accepts sortBy=%s', (sortBy) => {
      expect(check({ sortBy })).toEqual([]);
    });

    it.each(['customerName', 'status', 'total_amount', 'total; DROP TABLE invoices'])(
      'rejects sortBy=%p rather than quietly falling back',
      (sortBy) => {
        expect(check({ sortBy })).toContain(
          'sortBy must be one of: invoiceDate, dueDate, totalAmount',
        );
      },
    );

    it('accepts either direction and normalises the case', () => {
      expect(check({ ordering: 'asc' })).toEqual([]);
      expect(shape({ ordering: 'asc' }).ordering).toBe('ASC');
    });

    it('rejects an ordering that is neither', () => {
      expect(check({ ordering: 'sideways' })).toContain('ordering must be ASC or DESC');
    });
  });

  describe('status', () => {
    it.each(['Draft', 'Pending', 'Paid', 'Overdue'])('accepts %s', (status) => {
      expect(check({ status })).toEqual([]);
    });

    it('is case sensitive, so a typo is reported rather than ignored', () => {
      expect(check({ status: 'overdue' })).toContain(
        'status must be one of: Draft, Pending, Paid, Overdue',
      );
    });
  });

  describe('keyword', () => {
    it('is trimmed', () => {
      expect(shape({ keyword: '  braddon  ' }).keyword).toBe('braddon');
    });

    it('is bounded', () => {
      expect(check({ keyword: 'x'.repeat(101) })).not.toEqual([]);
      expect(check({ keyword: 'x'.repeat(100) })).toEqual([]);
    });
  });

  describe('date range', () => {
    it('rejects a range that runs backwards', () => {
      expect(check({ fromDate: '2026-06-10', toDate: '2026-06-09' })).toContain(
        'toDate must be on or after fromDate',
      );
    });

    it('accepts a single day', () => {
      expect(check({ fromDate: '2026-06-10', toDate: '2026-06-10' })).toEqual([]);
    });

    it('accepts either bound on its own', () => {
      expect(check({ fromDate: '2026-06-10' })).toEqual([]);
      expect(check({ toDate: '2026-06-10' })).toEqual([]);
    });

    it('rejects a malformed bound', () => {
      expect(check({ fromDate: '10-06-2026' })).toContain(
        'fromDate must be a real date in YYYY-MM-DD form',
      );
    });
  });

  it('rejects a parameter it does not know about', () => {
    expect(check({ sortDirection: 'ASC' })).not.toEqual([]);
  });

  describe('malformed input', () => {
    // Query values arrive from the wire, so the transforms must tolerate an
    // array (?ordering=a&ordering=b) or a number without throwing.
    it.each([42, ['ASC', 'DESC'], {}])('rejects ordering=%p without throwing', (ordering) => {
      expect(() => shape({ ordering })).not.toThrow();
      expect(check({ ordering })).not.toEqual([]);
    });

    it('treats an explicit null as "not supplied"', () => {
      // @IsOptional() skips null as well as undefined, so ?ordering= falls back
      // to the default rather than being an error. Worth pinning either way.
      expect(check({ ordering: null })).toEqual([]);
    });

    it('survives a non-string keyword', () => {
      expect(() => shape({ keyword: 42 })).not.toThrow();
      expect(check({ keyword: 42 })).not.toEqual([]);
    });
  });
});
