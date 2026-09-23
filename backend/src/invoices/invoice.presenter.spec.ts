import { InvoiceStatus, Prisma } from '@prisma/client';
import { type FullInvoice, toRow, toView } from './invoice.presenter';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (v: string) => new Prisma.Decimal(v);

function build(overrides: Partial<FullInvoice> = {}): FullInvoice {
  return {
    id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    invoiceNumber: 'IV1780488206995',
    reference: '#5721662',
    invoiceDate: day('2026-06-03'),
    dueDate: day('2026-07-03'),
    currency: 'AUD',
    currencySymbol: 'AU$',
    description: 'Invoice is issued to Kanglee',
    status: InvoiceStatus.Pending,
    taxRate: dec('10.00'),
    subTotal: dec('2000.00'),
    taxTotal: dec('200.00'),
    discountTotal: dec('20.00'),
    total: dec('2180.00'),
    paid: dec('1451.34'),
    balance: dec('728.66'),
    customerId: 'c0000000-0000-4000-8000-000000000001',
    createdById: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    createdAt: new Date('2026-06-03T12:03:26.995Z'),
    updatedAt: new Date('2026-06-03T12:03:26.995Z'),
    customer: {
      id: 'c0000000-0000-4000-8000-000000000001',
      fullname: 'Paul',
      email: 'paul@101digital.io',
      mobileNumber: '947717364111',
      address: 'Singapore',
      createdAt: new Date('2026-06-03T12:03:26.995Z'),
      updatedAt: new Date('2026-06-03T12:03:26.995Z'),
    },
    lines: [
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000001',
        invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
        name: 'Honda RC150',
        quantity: 2,
        rate: dec('1000.00'),
        amount: dec('2000.00'),
        sequence: 0,
      },
    ],
    ...overrides,
  };
}

/** Inside the payment terms, so nothing derives as Overdue unless asked. */
const inTerms = new Date('2026-06-15T00:00:00.000Z');

describe('toRow', () => {
  it('produces exactly what the list needs', () => {
    expect(toRow(build(), inTerms)).toEqual({
      invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
      invoiceNumber: 'IV1780488206995',
      invoiceReference: '#5721662',
      invoiceDate: '2026-06-03',
      dueDate: '2026-07-03',
      currency: 'AUD',
      currencySymbol: 'AU$',
      totalAmount: 2180,
      balanceAmount: 728.66,
      status: 'Pending',
      customer: {
        id: 'c0000000-0000-4000-8000-000000000001',
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: '947717364111',
        address: 'Singapore',
      },
    });
  });

  it('turns Decimal columns into JSON numbers', () => {
    const row = toRow(build(), inTerms);

    expect(typeof row.totalAmount).toBe('number');
    expect(typeof row.balanceAmount).toBe('number');
  });

  it('applies the derived status using the clock it is given', () => {
    expect(toRow(build(), new Date('2026-08-01T00:00:00.000Z')).status).toBe('Overdue');
  });

  it('keeps detail-only fields out of a list row', () => {
    const row: Record<string, unknown> = { ...toRow(build(), inTerms) };

    for (const field of ['items', 'totalPaid', 'invoiceSubTotal', 'createdBy']) {
      expect(row).not.toHaveProperty(field);
    }
  });

  it('passes null optional customer fields straight through', () => {
    const invoice = build();
    invoice.customer = { ...invoice.customer, mobileNumber: null, address: null };

    expect(toRow(invoice, inTerms).customer).toMatchObject({
      mobileNumber: null,
      address: null,
    });
  });
});

describe('toView', () => {
  it('adds the full breakdown on top of the row', () => {
    expect(toView(build(), inTerms)).toMatchObject({
      ...toRow(build(), inTerms),
      description: 'Invoice is issued to Kanglee',
      invoiceSubTotal: 2000,
      taxRate: 10,
      totalTax: 200,
      totalDiscount: 20,
      totalPaid: 1451.34,
      createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
      createdAt: '2026-06-03T12:03:26.995Z',
    });
  });

  it('exposes the stored line amount rather than making the client multiply', () => {
    expect(toView(build(), inTerms).items).toEqual([
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000001',
        name: 'Honda RC150',
        quantity: 2,
        rate: 1000,
        amount: 2000,
      },
    ]);
  });

  it('orders lines by sequence, not by however the rows came back', () => {
    const invoice = build();
    invoice.lines = [
      { ...invoice.lines[0], id: 'b', name: 'Second', sequence: 1 },
      { ...invoice.lines[0], id: 'a', name: 'First', sequence: 0 },
    ];

    expect(toView(invoice, inTerms).items.map((i) => i.name)).toEqual(['First', 'Second']);
  });

  it('does not reorder the entity while sorting', () => {
    const invoice = build();
    invoice.lines = [
      { ...invoice.lines[0], id: 'b', sequence: 1 },
      { ...invoice.lines[0], id: 'a', sequence: 0 },
    ];

    toView(invoice, inTerms);

    expect(invoice.lines.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('copes with an invoice loaded without its lines', () => {
    expect(toView(build({ lines: undefined as never }), inTerms).items).toEqual([]);
  });
});
