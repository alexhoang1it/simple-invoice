import { describe, expect, it } from 'vitest';
import {
  describeDue,
  formatDate,
  formatMoney,
  formatTimestamp,
  isoPlusDays,
  todayIso,
} from './format';

describe('formatMoney', () => {
  it('uses the symbol stored on the invoice, not one guessed from the locale', () => {
    expect(formatMoney(2180, 'AU$')).toBe('AU$2,180.00');
    expect(formatMoney(2180, 'US$', 'USD')).toBe('US$2,180.00');
    expect(formatMoney(2180, '£', 'GBP')).toBe('£2,180.00');
  });

  it('always shows cents', () => {
    expect(formatMoney(1000, 'AU$')).toBe('AU$1,000.00');
    expect(formatMoney(728.6, 'AU$')).toBe('AU$728.60');
    expect(formatMoney(0, 'AU$')).toBe('AU$0.00');
  });

  it('groups thousands', () => {
    expect(formatMoney(1234567.89, 'AU$')).toBe('AU$1,234,567.89');
  });

  it('drops the decimals for currencies that have no minor unit', () => {
    expect(formatMoney(150000, '¥', 'JPY')).toBe('¥150,000');
    expect(formatMoney(2500000, '₫', 'VND')).toBe('₫2,500,000');
  });

  it('puts the minus sign in front of the symbol', () => {
    expect(formatMoney(-120, 'AU$')).toBe('-AU$120.00');
  });
});

describe('formatDate', () => {
  it('reads the date in UTC so it cannot slip a day', () => {
    expect(formatDate('2026-06-03')).toBe('3 Jun 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('hands back anything that is not a date unchanged', () => {
    expect(formatDate('soon')).toBe('soon');
    expect(formatDate('')).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('renders an instant in the local zone with a 24-hour clock', () => {
    expect(formatTimestamp('2026-06-03T12:03:26.995Z')).toMatch(
      /^\d{1,2} [A-Z][a-z]{2} 2026 at \d{2}:\d{2}$/,
    );
  });

  it('hands back something unparseable unchanged', () => {
    expect(formatTimestamp('rubbish')).toBe('rubbish');
  });
});

describe('describeDue', () => {
  const today = new Date('2026-06-15T08:00:00.000Z');

  it.each([
    ['2026-06-15', 'due today'],
    ['2026-06-16', 'due tomorrow'],
    ['2026-06-21', 'in 6 days'],
    ['2026-06-14', '1 day late'],
    ['2026-06-03', '12 days late'],
  ])('describes %s as %p', (dueDate, expected) => {
    expect(describeDue(dueDate, today)).toBe(expected);
  });

  it('returns nothing for an unparseable date', () => {
    expect(describeDue('whenever', today)).toBeNull();
  });
});

describe('date helpers', () => {
  it('todayIso formats today as YYYY-MM-DD', () => {
    expect(todayIso(new Date('2026-09-23T22:15:00.000Z'))).toBe('2026-09-23');
  });

  it('isoPlusDays walks forward, rolling over the month', () => {
    expect(isoPlusDays(30, new Date('2026-06-03T00:00:00.000Z'))).toBe('2026-07-03');
    expect(isoPlusDays(1, new Date('2026-12-31T00:00:00.000Z'))).toBe('2027-01-01');
  });
});
