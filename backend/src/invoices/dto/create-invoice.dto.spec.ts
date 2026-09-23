import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto';

// Runs the DTO through the same transform-then-validate path the global
// ValidationPipe uses, so these assertions describe what a real POST /invoices
// would actually be answered with. The e2e run proves the pipe is wired up;
// enumerating the rule matrix is far cheaper here than over HTTP.

function check(body: unknown): string[] {
  const dto = plainToInstance(CreateInvoiceDto, body);

  return flatten(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }));
}

function flatten(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...flatten(e.children ?? []),
  ]);
}

const shape = (body: unknown) => plainToInstance(CreateInvoiceDto, body);

const good = () => ({
  invoiceNumber: 'SI-2026-0148',
  reference: 'PO-77431',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Q2 freight consolidation',
  customer: {
    fullname: 'Braddon Freight Co',
    email: 'ap@braddonfreight.com.au',
    mobileNumber: '+61 2 6100 4455',
    address: '14 Lonsdale St, Braddon ACT 2612',
  },
  lines: [{ name: 'Freight forwarding', quantity: 2, rate: 1000 }],
  taxRate: 10,
  discount: 20,
});

describe('CreateInvoiceDto', () => {
  it('passes a complete payload', () => {
    expect(check(good())).toEqual([]);
  });

  it('passes with only the mandatory fields', () => {
    const { reference, description, taxRate, discount, ...required } = good();

    expect(check(required)).toEqual([]);
    expect([reference, description, taxRate, discount]).toBeDefined();
  });

  describe('due date', () => {
    it('must not precede the invoice date', () => {
      expect(check({ ...good(), invoiceDate: '2026-06-10', dueDate: '2026-06-09' })).toContain(
        'dueDate must be on or after invoiceDate',
      );
    });

    it('may equal the invoice date', () => {
      expect(check({ ...good(), invoiceDate: '2026-06-10', dueDate: '2026-06-10' })).toEqual(
        [],
      );
    });

    it('compares chronologically across a year boundary', () => {
      expect(check({ ...good(), invoiceDate: '2026-12-31', dueDate: '2027-01-01' })).toEqual(
        [],
      );
      expect(check({ ...good(), invoiceDate: '2027-01-01', dueDate: '2026-12-31' })).toContain(
        'dueDate must be on or after invoiceDate',
      );
    });

    it('stays quiet about ordering when the other date is unusable', () => {
      const messages = check({ ...good(), invoiceDate: 'nonsense' });

      expect(messages).toContain('invoiceDate must be a real date in YYYY-MM-DD form');
      expect(messages).not.toContain('dueDate must be on or after invoiceDate');
    });
  });

  describe('dates', () => {
    it.each(['2026-6-3', '03-06-2026', '2026/06/03', '2026-06-03T00:00:00Z', ''])(
      'rejects %p',
      (invoiceDate) => {
        expect(check({ ...good(), invoiceDate })).toContain(
          'invoiceDate must be a real date in YYYY-MM-DD form',
        );
      },
    );

    it.each(['2026-02-30', '2026-13-01', '2025-02-29'])(
      'rejects %s, which is well formed but not a real day',
      (invoiceDate) => {
        expect(check({ ...good(), invoiceDate })).not.toEqual([]);
      },
    );

    it('accepts 29 February in a leap year', () => {
      expect(check({ ...good(), invoiceDate: '2028-02-29', dueDate: '2028-03-29' })).toEqual(
        [],
      );
    });
  });

  describe('invoice number', () => {
    it('is required', () => {
      const { invoiceNumber, ...rest } = good();

      expect(check(rest)).toContain('invoiceNumber is required');
      expect(invoiceNumber).toBeDefined();
    });

    it('rejects whitespace only', () => {
      expect(check({ ...good(), invoiceNumber: '    ' })).toContain(
        'invoiceNumber is required',
      );
    });

    it('is trimmed, so padding cannot dodge the unique index', () => {
      expect(shape({ ...good(), invoiceNumber: '  SI-1  ' }).invoiceNumber).toBe('SI-1');
    });

    it('is capped at 64 characters', () => {
      expect(check({ ...good(), invoiceNumber: 'X'.repeat(65) })).not.toEqual([]);
    });
  });

  describe('currency', () => {
    it.each(['AU', 'AUDD', 'AU1', 'AUSTRALIAN', ''])('rejects %p', (currency) => {
      expect(check({ ...good(), currency })).toContain(
        'currency must be a 3-letter ISO 4217 code',
      );
    });

    it('upper-cases rather than rejecting a lower-case code', () => {
      expect(shape({ ...good(), currency: 'aud' }).currency).toBe('AUD');
      expect(check({ ...good(), currency: 'aud' })).toEqual([]);
    });
  });

  describe('customer', () => {
    it('needs a name', () => {
      const body = good();

      expect(check({ ...body, customer: { ...body.customer, fullname: '  ' } })).toContain(
        'customer.fullname is required',
      );
    });

    it.each(['nope', 'nope@', '@example.com'])('rejects %p as an email', (email) => {
      const body = good();

      expect(check({ ...body, customer: { ...body.customer, email } })).toContain(
        'customer.email must be a valid email address',
      );
    });

    it('lower-cases the email so the customer lookup is stable', () => {
      const body = good();
      const dto = shape({
        ...body,
        customer: { ...body.customer, email: ' AP@Braddon.COM.AU ' },
      });

      expect(dto.customer.email).toBe('ap@braddon.com.au');
    });

    it('treats mobile and address as optional', () => {
      expect(
        check({ ...good(), customer: { fullname: 'Paul', email: 'paul@101digital.io' } }),
      ).toEqual([]);
    });

    it('validates the nested object instead of accepting any shape', () => {
      expect(check({ ...good(), customer: {} })).not.toEqual([]);
    });
  });

  describe('lines', () => {
    it('requires exactly one', () => {
      expect(check({ ...good(), lines: [] })).toContain('exactly one line is required');
      expect(
        check({
          ...good(),
          lines: [
            { name: 'A', quantity: 1, rate: 10 },
            { name: 'B', quantity: 1, rate: 10 },
          ],
        }),
      ).toContain('exactly one line is required');
    });

    it('needs a name', () => {
      expect(check({ ...good(), lines: [{ name: ' ', quantity: 1, rate: 10 }] })).toContain(
        'lines.0.name is required',
      );
    });

    it.each([1.5, 0, -1])('rejects a quantity of %p', (quantity) => {
      expect(check({ ...good(), lines: [{ name: 'X', quantity, rate: 10 }] })).not.toEqual([]);
    });

    it.each([0, -5])('rejects a rate of %p', (rate) => {
      expect(check({ ...good(), lines: [{ name: 'X', quantity: 1, rate }] })).toContain(
        'lines.0.rate must be greater than zero',
      );
    });

    it('rejects a rate with sub-cent precision', () => {
      expect(check({ ...good(), lines: [{ name: 'X', quantity: 1, rate: 10.999 }] })).toContain(
        'lines.0.rate allows at most 2 decimal places',
      );
    });

    it('coerces numeric strings, because form fields arrive as strings', () => {
      const dto = shape({ ...good(), lines: [{ name: 'X', quantity: '3', rate: '99.99' }] });

      expect(dto.lines[0]).toMatchObject({ quantity: 3, rate: 99.99 });
    });
  });

  describe('tax and discount', () => {
    it('are optional so the service can apply its defaults', () => {
      const { taxRate, discount, ...rest } = good();
      const dto = shape(rest);

      expect(dto.taxRate).toBeUndefined();
      expect(dto.discount).toBeUndefined();
      expect([taxRate, discount]).toBeDefined();
    });

    it.each([-0.01, 100.01, 150])('rejects a tax rate of %p', (taxRate) => {
      expect(check({ ...good(), taxRate })).not.toEqual([]);
    });

    it.each([0, 100])('accepts a tax rate of %p', (taxRate) => {
      expect(check({ ...good(), taxRate })).toEqual([]);
    });

    it('rejects a negative discount', () => {
      expect(check({ ...good(), discount: -1 })).toContain('discount cannot be negative');
    });
  });

  // This is what makes "the server owns the totals" real rather than a promise.
  it.each(['totalAmount', 'invoiceSubTotal', 'balanceAmount', 'status', 'createdBy', 'paid'])(
    'refuses a client-supplied %s',
    (field) => {
      expect(check({ ...good(), [field]: 1 })).not.toEqual([]);
    },
  );

  describe('malformed input', () => {
    // The trim/case transforms run before validation, so they have to survive a
    // value that is not a string and leave the complaining to the validator.
    it.each([42, null, true, [], {}])(
      'does not choke on %p where a string belongs',
      (value) => {
        expect(() => shape({ ...good(), invoiceNumber: value, currency: value })).not.toThrow();
        expect(check({ ...good(), invoiceNumber: value })).not.toEqual([]);
      },
    );

    it('reports a non-object customer rather than throwing', () => {
      expect(() => check({ ...good(), customer: 'Braddon Freight' })).not.toThrow();
      expect(check({ ...good(), customer: 'Braddon Freight' })).not.toEqual([]);
    });

    it('reports a non-array lines value', () => {
      expect(check({ ...good(), lines: 'one widget' })).not.toEqual([]);
    });
  });
});
