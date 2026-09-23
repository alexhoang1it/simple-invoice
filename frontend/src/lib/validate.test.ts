import { describe, expect, it } from 'vitest';
import {
  amountInRange,
  email,
  firstError,
  isClean,
  isoDate,
  maxLength,
  notBefore,
  positiveAmount,
  required,
  validate,
  wholeNumber,
} from './validate';

describe('required', () => {
  it('rejects blank and whitespace', () => {
    expect(required('Name')('')).toBe('Name is required');
    expect(required('Name')('   ')).toBe('Name is required');
  });

  it('accepts anything with content', () => {
    expect(required('Name')('Paul')).toBeNull();
  });
});

describe('email', () => {
  it.each(['nope', 'nope@', '@example.com', 'a b@example.com'])('rejects %p', (value) => {
    expect(email()(value)).toBe('Email must look like an email address');
  });

  it.each(['a@b.co', 'ap@braddonfreight.com.au', 'first.last+tag@sub.domain.io'])(
    'accepts %p',
    (value) => {
      expect(email()(value)).toBeNull();
    },
  );

  it('leaves an empty value to the required rule', () => {
    // Otherwise a blank field would show two complaints at once.
    expect(email()('')).toBeNull();
  });
});

describe('isoDate', () => {
  it('accepts a real calendar date', () => {
    expect(isoDate('Issue date')('2026-06-03')).toBeNull();
  });

  it.each(['2026-6-3', '03-06-2026', '2026/06/03'])('rejects the shape of %p', (value) => {
    expect(isoDate('Issue date')(value)).toBe('Issue date must be a date');
  });

  it.each(['2026-02-30', '2026-13-01', '2025-02-29'])(
    'rejects %s, which is not a real day',
    (value) => {
      expect(isoDate('Issue date')(value)).toBe('Issue date is not a real date');
    },
  );

  it('accepts 29 February in a leap year', () => {
    expect(isoDate('Issue date')('2028-02-29')).toBeNull();
  });
});

describe('wholeNumber', () => {
  it.each(['1', '12', '1000'])('accepts %p', (value) => {
    expect(wholeNumber('Quantity')(value)).toBeNull();
  });

  it('rejects a fraction', () => {
    expect(wholeNumber('Quantity')('1.5')).toBe('Quantity must be a whole number');
  });

  it('rejects anything below the floor', () => {
    expect(wholeNumber('Quantity')('0')).toBe('Quantity must be at least 1');
  });

  it('rejects text', () => {
    expect(wholeNumber('Quantity')('two')).toBe('Quantity must be a whole number');
  });
});

describe('positiveAmount', () => {
  it('accepts an amount with up to two decimals', () => {
    expect(positiveAmount('Rate')('1000')).toBeNull();
    expect(positiveAmount('Rate')('99.99')).toBeNull();
  });

  it.each(['0', '-5'])('rejects %p', (value) => {
    expect(positiveAmount('Rate')(value)).toBe('Rate must be more than zero');
  });

  it('rejects sub-cent precision', () => {
    expect(positiveAmount('Rate')('10.999')).toBe('Rate can have at most 2 decimal places');
  });
});

describe('amountInRange', () => {
  it.each(['0', '10', '100'])('accepts %p inside the range', (value) => {
    expect(amountInRange('Tax', 0, 100)(value)).toBeNull();
  });

  it.each(['-1', '101'])('rejects %p outside the range', (value) => {
    expect(amountInRange('Tax', 0, 100)(value)).toBe('Tax must be between 0 and 100');
  });
});

describe('maxLength', () => {
  it('measures the trimmed value', () => {
    expect(maxLength('Note', 5)('  abc  ')).toBeNull();
    expect(maxLength('Note', 5)('abcdef')).toBe('Note must be 5 characters or fewer');
  });
});

describe('notBefore', () => {
  it('accepts a later or equal date', () => {
    expect(notBefore('Due date', '2026-06-10', 'invoice date')('2026-06-10')).toBeNull();
    expect(notBefore('Due date', '2026-06-10', 'invoice date')('2026-07-10')).toBeNull();
  });

  it('rejects an earlier date', () => {
    expect(notBefore('Due date', '2026-06-10', 'invoice date')('2026-06-09')).toBe(
      'Due date cannot be before the invoice date',
    );
  });

  it('compares across a year boundary', () => {
    expect(notBefore('Due date', '2026-12-31', 'invoice date')('2027-01-01')).toBeNull();
    expect(notBefore('Due date', '2027-01-01', 'invoice date')('2026-12-31')).not.toBeNull();
  });

  it('stays quiet while either side is still malformed', () => {
    expect(notBefore('Due date', 'nonsense', 'invoice date')('2026-06-09')).toBeNull();
    expect(notBefore('Due date', '2026-06-10', 'invoice date')('')).toBeNull();
  });
});

describe('firstError', () => {
  it('reports the first rule that complains and stops there', () => {
    expect(firstError('', [required('Email'), email()])).toBe('Email is required');
  });

  it('returns null when every rule is happy', () => {
    expect(firstError('a@b.co', [required('Email'), email()])).toBeNull();
  });
});

describe('validate', () => {
  it('collects one message per field', () => {
    const errors = validate(
      { name: '', address: 'x' },
      { name: [required('Name')], address: [maxLength('Address', 0)] },
    );

    expect(errors).toEqual({
      name: 'Name is required',
      address: 'Address must be 0 characters or fewer',
    });
  });

  it('leaves clean fields out entirely', () => {
    const errors = validate({ name: 'Paul' }, { name: [required('Name')] });

    expect(errors).toEqual({});
    expect(isClean(errors)).toBe(true);
  });

  it('treats a missing key as empty rather than crashing', () => {
    const errors = validate({} as Record<'name', string>, { name: [required('Name')] });

    expect(errors.name).toBe('Name is required');
  });
});
