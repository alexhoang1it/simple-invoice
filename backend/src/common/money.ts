import { Decimal } from 'decimal.js';

// Money never touches a JS number in this codebase.
//
// Prisma hands `Decimal` columns back as decimal.js instances, and every
// calculation stays in that type until the very last step, where toJSON()
// produces a string for the wire. That sidesteps the whole class of bugs where
// 0.1 + 0.2 quietly becomes 0.30000000000000004, without the string-shifting
// tricks you need if you insist on doing the arithmetic in floats.

// ROUND_HALF_UP is what an invoice reader expects: 8.475 -> 8.48.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export const SCALE = 2;

export type MoneyInput = Decimal | string | number;

export function money(value: MoneyInput): Decimal {
  const d = new Decimal(value);

  if (!d.isFinite()) {
    throw new RangeError(`Not a usable amount: ${String(value)}`);
  }

  return d;
}

/** Rounds to cents. Call this on anything that is about to be stored. */
export function round(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(SCALE);
}

export function add(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((sum, v) => sum.plus(money(v)), new Decimal(0));
}

export function sub(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).minus(money(b));
}

export function mul(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).times(money(b));
}

/** `percent` is a rate out of 100, so 10 means 10%. */
export function percentOf(amount: MoneyInput, percent: MoneyInput): Decimal {
  return money(amount).times(money(percent)).dividedBy(100);
}

export function isNegative(value: MoneyInput): boolean {
  return money(value).isNegative();
}

/** Fixed-scale string, e.g. for a CSV export or a log line. */
export function toFixed(value: MoneyInput): string {
  return round(value).toFixed(SCALE);
}

/**
 * Converts to a JSON number for the response body. The sample payload in the
 * brief uses numbers, and every stored amount is numeric(14,2), which is well
 * inside the range a double represents exactly once rounded to cents.
 */
export function asNumber(value: MoneyInput): number {
  return round(value).toNumber();
}
