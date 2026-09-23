/**
 * A tiny validation kit for the two forms in this app.
 *
 * Rules are plain predicates returning a message or null, composed per field.
 * They exist to tell the user about a mistake while they type — the API
 * validates the same payload again and its answer is what actually counts, so
 * there is no value in dragging a schema library in for this much.
 */

export type Rule<T = string> = (value: T) => string | null;

export type Errors<F extends string> = Partial<Record<F, string>>;

/** First rule that complains wins; a field shows one message at a time. */
export function firstError<T>(value: T, rules: Rule<T>[]): string | null {
  for (const rule of rules) {
    const message = rule(value);
    if (message) return message;
  }

  return null;
}

export function validate<F extends string>(
  values: Record<F, string>,
  rules: Partial<Record<F, Rule[]>>,
): Errors<F> {
  const errors: Errors<F> = {};

  for (const field of Object.keys(rules) as F[]) {
    const message = firstError(values[field] ?? '', rules[field] ?? []);
    if (message) errors[field] = message;
  }

  return errors;
}

export const isClean = <F extends string>(errors: Errors<F>): boolean =>
  Object.keys(errors).length === 0;

// -- rules ------------------------------------------------------------------

export const required =
  (label: string): Rule =>
  (value) =>
    value.trim() === '' ? `${label} is required` : null;

// Deliberately permissive: the server does the authoritative check, and an
// over-strict client pattern rejects addresses that are perfectly valid.
export const email =
  (label = 'Email'): Rule =>
  (value) =>
    value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      ? null
      : `${label} must look like an email address`;

export const isoDate =
  (label: string): Rule =>
  (value) => {
    if (value.trim() === '') return `${label} is required`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${label} must be a date`;

    const parsed = new Date(`${value}T00:00:00.000Z`);
    const real = !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);

    return real ? null : `${label} is not a real date`;
  };

export const wholeNumber =
  (label: string, min = 1): Rule =>
  (value) => {
    if (value.trim() === '') return `${label} is required`;

    const parsed = Number(value);

    if (!Number.isInteger(parsed)) return `${label} must be a whole number`;
    if (parsed < min) return `${label} must be at least ${min}`;

    return null;
  };

export const positiveAmount =
  (label: string): Rule =>
  (value) => {
    if (value.trim() === '') return `${label} is required`;

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return `${label} must be a number`;
    if (parsed <= 0) return `${label} must be more than zero`;
    if (!hasAtMostTwoDecimals(value)) return `${label} can have at most 2 decimal places`;

    return null;
  };

export const amountInRange =
  (label: string, min: number, max: number): Rule =>
  (value) => {
    if (value.trim() === '') return `${label} is required`;

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return `${label} must be a number`;
    if (parsed < min || parsed > max) return `${label} must be between ${min} and ${max}`;
    if (!hasAtMostTwoDecimals(value)) return `${label} can have at most 2 decimal places`;

    return null;
  };

export const maxLength =
  (label: string, limit: number): Rule =>
  (value) =>
    value.trim().length > limit ? `${label} must be ${limit} characters or fewer` : null;

/** Cross-field: `value` must not fall before the date held in `other`. */
export const notBefore =
  (label: string, other: string, otherLabel: string): Rule =>
  (value) => {
    if (!isDateish(value) || !isDateish(other)) return null;

    // Zero-padded ISO dates sort lexicographically in date order.
    return value >= other ? null : `${label} cannot be before the ${otherLabel}`;
  };

function isDateish(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasAtMostTwoDecimals(value: string): boolean {
  const decimals = value.trim().split('.')[1];

  return decimals === undefined || decimals.length <= 2;
}
