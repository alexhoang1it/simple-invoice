import { Decimal } from 'decimal.js';
import { add, asNumber, isNegative, money, mul, percentOf, round, sub, toFixed } from './money';

describe('money', () => {
  it('accepts numbers, strings and Decimals', () => {
    expect(money(12.5).toFixed(2)).toBe('12.50');
    expect(money('12.50').toFixed(2)).toBe('12.50');
    expect(money(new Decimal('12.5')).toFixed(2)).toBe('12.50');
  });

  it('rejects values that are not real amounts', () => {
    expect(() => money(Number.NaN)).toThrow(RangeError);
    expect(() => money(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('add', () => {
  it('is exact where floats are not', () => {
    // 0.1 + 0.2 === 0.30000000000000004 as doubles.
    expect(add(0.1, 0.2).toFixed(2)).toBe('0.30');
  });

  it('sums an arbitrary number of amounts', () => {
    expect(add('1000.00', '250.50', '99.99').toFixed(2)).toBe('1350.49');
  });

  it('returns zero for no arguments', () => {
    expect(add().toFixed(2)).toBe('0.00');
  });
});

describe('sub / mul', () => {
  it('subtracts without drift', () => {
    expect(sub('2180.00', '1451.34').toFixed(2)).toBe('728.66');
  });

  it('multiplies without drift', () => {
    // 3 * 33.33 is 99.99000000000001 as doubles.
    expect(mul(3, '33.33').toFixed(2)).toBe('99.99');
  });
});

describe('percentOf', () => {
  it('reads the rate as a percentage, not a fraction', () => {
    expect(percentOf('2000.00', 10).toFixed(2)).toBe('200.00');
  });

  it('handles a zero rate', () => {
    expect(percentOf('2000.00', 0).toFixed(2)).toBe('0.00');
  });

  it('keeps full precision until it is rounded', () => {
    // 99.99 at 10% is exactly 9.999; rounding happens at the caller.
    expect(percentOf('99.99', 10).toString()).toBe('9.999');
    expect(round(percentOf('99.99', 10)).toFixed(2)).toBe('10.00');
  });
});

describe('round', () => {
  it('rounds half up, the way an invoice reader expects', () => {
    expect(round('1.005').toFixed(2)).toBe('1.01');
    expect(round('8.475').toFixed(2)).toBe('8.48');
    expect(round('2.675').toFixed(2)).toBe('2.68');
  });

  it('rounds down below the halfway point', () => {
    expect(round('10.234').toFixed(2)).toBe('10.23');
    expect(round('0.004').toFixed(2)).toBe('0.00');
  });

  it('leaves two-decimal values alone', () => {
    expect(round('2180.00').toFixed(2)).toBe('2180.00');
  });
});

describe('isNegative', () => {
  it('spots an overpaid balance', () => {
    expect(isNegative('-20.00')).toBe(true);
    expect(isNegative('0.00')).toBe(false);
    expect(isNegative('0.01')).toBe(false);
  });
});

describe('serialization', () => {
  it('toFixed always shows cents', () => {
    expect(toFixed(2180)).toBe('2180.00');
    expect(toFixed('728.6')).toBe('728.60');
  });

  it('asNumber produces the JSON number the sample payload uses', () => {
    expect(asNumber('2180.00')).toBe(2180);
    expect(asNumber('728.66')).toBe(728.66);
    expect(asNumber('-20.00')).toBe(-20);
  });
});
