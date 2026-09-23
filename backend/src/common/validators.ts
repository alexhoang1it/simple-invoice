import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isIsoDate } from './dates';

@ValidatorConstraint({ name: 'CalendarDate', async: false })
class CalendarDateRule implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isIsoDate(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a real date in YYYY-MM-DD form`;
  }
}

/**
 * A calendar date, strictly `YYYY-MM-DD`.
 *
 * `@IsDateString()` would also swallow a full timestamp, which invites a client
 * to send `2026-06-03T00:00:00+10:00` and have the stored date silently land a
 * day out. Rejecting anything but a bare date keeps it unambiguous.
 */
export function IsCalendarDate(options?: ValidationOptions) {
  return (target: object, property: string): void => {
    registerDecorator({
      target: target.constructor,
      propertyName: property,
      options,
      validator: CalendarDateRule,
    });
  };
}

@ValidatorConstraint({ name: 'NotBefore', async: false })
class NotBeforeRule implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [other] = args.constraints as [string];
    const against = (args.object as Record<string, unknown>)[other];

    // If either side is malformed its own validator already complains; a second
    // message about the same field is just noise.
    if (!isIsoDate(value) || !isIsoDate(against)) return true;

    // Zero-padded ISO dates sort lexicographically in date order.
    return value >= against;
  }

  defaultMessage(args: ValidationArguments): string {
    const [other] = args.constraints as [string];

    return `${args.property} must be on or after ${other}`;
  }
}

/** Cross-field date ordering, e.g. dueDate must not precede invoiceDate. */
export function NotBefore(other: string, options?: ValidationOptions) {
  return (target: object, property: string): void => {
    registerDecorator({
      target: target.constructor,
      propertyName: property,
      options,
      constraints: [other],
      validator: NotBeforeRule,
    });
  };
}
