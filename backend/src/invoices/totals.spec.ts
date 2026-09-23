import { computeTotals, DiscountTooLarge } from './totals';

/** Reads a Totals result as plain strings so assertions stay legible. */
function shown(t: ReturnType<typeof computeTotals>) {
  return {
    subTotal: t.subTotal.toFixed(2),
    taxTotal: t.taxTotal.toFixed(2),
    discountTotal: t.discountTotal.toFixed(2),
    total: t.total.toFixed(2),
    paid: t.paid.toFixed(2),
    balance: t.balance.toFixed(2),
  };
}

describe('computeTotals', () => {
  it('matches the worked example in the brief', () => {
    // Appendix A: 2 x Honda RC150 @ 1000, 10% tax, 20 off, 1451.34 already paid.
    const totals = computeTotals({
      lines: [{ quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 20,
      paid: '1451.34',
    });

    expect(shown(totals)).toEqual({
      subTotal: '2000.00',
      taxTotal: '200.00',
      discountTotal: '20.00',
      total: '2180.00',
      paid: '1451.34',
      balance: '728.66',
    });
  });

  it('treats a new invoice as unpaid, so the balance is the full total', () => {
    const totals = computeTotals({
      lines: [{ quantity: 3, rate: 250 }],
      taxRate: 10,
      discount: 0,
    });

    expect(shown(totals)).toMatchObject({ total: '825.00', paid: '0.00', balance: '825.00' });
  });

  it('handles a zero tax rate', () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, rate: '499.95' }],
      taxRate: 0,
      discount: 0,
    });

    expect(shown(totals)).toMatchObject({ taxTotal: '0.00', total: '499.95' });
  });

  it('applies the discount after tax, not before', () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, rate: 1000 }],
      taxRate: 15,
      discount: 100,
    });

    expect(shown(totals)).toMatchObject({ taxTotal: '150.00', total: '1050.00' });
  });

  it('keeps the arithmetic exact where floats would drift', () => {
    // 3 x 33.33 is 99.99000000000001 as doubles; 10% of that is 9.999.
    const totals = computeTotals({
      lines: [{ quantity: 3, rate: '33.33' }],
      taxRate: 10,
      discount: 0,
    });

    expect(shown(totals)).toMatchObject({
      subTotal: '99.99',
      taxTotal: '10.00',
      total: '109.99',
    });
  });

  it('produces figures that add up as printed', () => {
    const totals = computeTotals({
      lines: [{ quantity: 7, rate: '19.99' }],
      taxRate: '8.25',
      discount: '5.55',
    });

    const { subTotal, taxTotal, discountTotal, total } = totals;

    expect(subTotal.plus(taxTotal).minus(discountTotal).toFixed(2)).toBe(total.toFixed(2));
  });

  it('sums every line, ready for multi-line invoices', () => {
    const totals = computeTotals({
      lines: [
        { quantity: 2, rate: '19.99' },
        { quantity: 5, rate: '4.50' },
      ],
      taxRate: 10,
      discount: 0,
    });

    expect(totals.lineAmounts.map((a) => a.toFixed(2))).toEqual(['39.98', '22.50']);
    expect(shown(totals)).toMatchObject({
      subTotal: '62.48',
      taxTotal: '6.25',
      total: '68.73',
    });
  });

  it('allows a discount that wipes out the whole invoice', () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 110,
    });

    expect(shown(totals)).toMatchObject({ total: '0.00', balance: '0.00' });
  });

  it('refuses a discount larger than the invoice', () => {
    expect(() =>
      computeTotals({ lines: [{ quantity: 1, rate: 100 }], taxRate: 10, discount: '110.01' }),
    ).toThrow(DiscountTooLarge);
  });

  it('refuses an invoice with no lines', () => {
    expect(() => computeTotals({ lines: [], taxRate: 10, discount: 0 })).toThrow(
      'an invoice needs at least one line',
    );
  });

  it('reports a negative balance when an invoice has been overpaid', () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, rate: 100 }],
      taxRate: 0,
      discount: 0,
      paid: 120,
    });

    expect(totals.balance.toFixed(2)).toBe('-20.00');
  });
});
