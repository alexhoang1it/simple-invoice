import { type Decimal } from 'decimal.js';
import { add, type MoneyInput, mul, percentOf, round, sub } from '../common/money';

export interface LineInput {
  quantity: number;
  rate: MoneyInput;
}

export interface TotalsInput {
  lines: readonly LineInput[];
  /** Percentage out of 100, so 10 is 10%. */
  taxRate: MoneyInput;
  /** Cash amount off, applied after tax. */
  discount: MoneyInput;
  /** Settled so far. Zero for anything the API creates. */
  paid?: MoneyInput;
}

export interface Totals {
  lineAmounts: Decimal[];
  subTotal: Decimal;
  taxTotal: Decimal;
  discountTotal: Decimal;
  total: Decimal;
  paid: Decimal;
  balance: Decimal;
}

export class DiscountTooLarge extends Error {
  constructor(
    readonly gross: Decimal,
    readonly discount: Decimal,
  ) {
    super(`discount ${discount.toFixed(2)} is more than the invoice total ${gross.toFixed(2)}`);
    this.name = 'DiscountTooLarge';
  }
}

/**
 * The only place invoice arithmetic happens.
 *
 *   subTotal = sum(quantity x rate)
 *   tax      = subTotal x rate%
 *   total    = subTotal + tax - discount
 *   balance  = total - paid
 *
 * Each step is rounded to cents before feeding the next, so the stored figures
 * add up exactly as they are printed — a reader can check the detail page with
 * a calculator and get the same answer.
 *
 * The brief fixes invoices at one line, but summing a list costs nothing and
 * means multi-line support later is a DTO change, not a rewrite of the money.
 */
export function computeTotals(input: TotalsInput): Totals {
  if (input.lines.length === 0) {
    throw new Error('an invoice needs at least one line');
  }

  const lineAmounts = input.lines.map((line) => round(mul(line.quantity, line.rate)));

  const subTotal = round(add(...lineAmounts));
  const taxTotal = round(percentOf(subTotal, input.taxRate));
  const discountTotal = round(input.discount);
  const gross = round(add(subTotal, taxTotal));

  if (discountTotal.greaterThan(gross)) {
    throw new DiscountTooLarge(gross, discountTotal);
  }

  const total = round(sub(gross, discountTotal));
  const paid = round(input.paid ?? 0);

  return {
    lineAmounts,
    subTotal,
    taxTotal,
    discountTotal,
    total,
    paid,
    balance: round(sub(total, paid)),
  };
}
