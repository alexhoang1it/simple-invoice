import { fromIsoDate, isIsoDate, startOfToday, toIsoDate } from './dates';

describe('toIsoDate', () => {
  it('reads the UTC fields, so the date never slips by a day', () => {
    expect(toIsoDate(new Date('2026-06-03T00:00:00.000Z'))).toBe('2026-06-03');
    expect(toIsoDate(new Date('2026-06-03T23:59:59.999Z'))).toBe('2026-06-03');
    expect(toIsoDate(new Date('2026-06-04T00:00:00.000Z'))).toBe('2026-06-04');
  });
});

describe('fromIsoDate', () => {
  it('parses a calendar date to UTC midnight', () => {
    expect(fromIsoDate('2026-06-03')?.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it.each(['2026-6-3', '03-06-2026', '2026/06/03', '2026-06-03T00:00:00Z', '', 'today'])(
    'rejects %p',
    (input) => {
      expect(fromIsoDate(input)).toBeNull();
    },
  );

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2025-02-29'])(
    'rejects %s, which looks right but is not a real date',
    (input) => {
      expect(fromIsoDate(input)).toBeNull();
    },
  );

  it('accepts 29 February in a leap year', () => {
    expect(fromIsoDate('2028-02-29')).not.toBeNull();
  });
});

describe('isIsoDate', () => {
  it('narrows a valid string', () => {
    expect(isIsoDate('2026-06-03')).toBe(true);
  });

  it.each([null, undefined, 42, {}, '2026-02-30'])('rejects %p', (input) => {
    expect(isIsoDate(input)).toBe(false);
  });
});

describe('startOfToday', () => {
  it('strips the time, leaving UTC midnight', () => {
    expect(startOfToday(new Date('2026-06-15T13:45:12.345Z')).toISOString()).toBe(
      '2026-06-15T00:00:00.000Z',
    );
  });

  it('does not roll over late in the UTC day', () => {
    expect(startOfToday(new Date('2026-06-15T23:59:59.999Z')).toISOString()).toBe(
      '2026-06-15T00:00:00.000Z',
    );
  });
});
