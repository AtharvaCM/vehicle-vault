import { z } from 'zod';

const numberFormatter = new Intl.NumberFormat('en-IN');

function formatBound(value: number | bigint | Date) {
  if (value instanceof Date) {
    return value.toLocaleDateString('en-IN');
  }

  return numberFormatter.format(value);
}

function pluralize(count: number | bigint, word: string) {
  return `${formatBound(count)} ${word}${Number(count) === 1 ? '' : 's'}`;
}

/**
 * The words every form falls back on when a schema gives no message of its own.
 * Zod's defaults ("Expected number, received nan", "String must contain at least
 * 8 character(s)") read like a crash to someone logging a fill at the pump, and
 * a schema message always wins over this map, so a field that knows better
 * ("Enter the litres") still says so.
 */
export const zodErrorMap: z.ZodErrorMap = (issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      // An empty number input reaches the schema as NaN or undefined: it is missing, not wrong.
      if (
        issue.received === z.ZodParsedType.undefined ||
        issue.received === z.ZodParsedType.null ||
        issue.received === z.ZodParsedType.nan
      ) {
        return { message: 'This field is required' };
      }

      // `.int()` reports a decimal as a type error, expecting "integer".
      if (issue.expected === z.ZodParsedType.integer) {
        return { message: 'Enter a whole number' };
      }

      if (issue.expected === z.ZodParsedType.number) {
        return { message: 'Enter a number' };
      }

      if (issue.expected === z.ZodParsedType.date) {
        return { message: 'Enter a valid date' };
      }

      return { message: 'Check this value' };

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message:
            Number(issue.minimum) <= 1
              ? 'This field is required'
              : `Use at least ${pluralize(issue.minimum, 'character')}`,
        };
      }

      if (issue.type === 'array' || issue.type === 'set') {
        return { message: `Add at least ${formatBound(issue.minimum)}` };
      }

      if (issue.type === 'date') {
        return { message: `Choose a date on or after ${formatBound(issue.minimum)}` };
      }

      if (issue.inclusive) {
        return {
          message:
            Number(issue.minimum) === 0
              ? 'Enter 0 or more'
              : `Enter ${formatBound(issue.minimum)} or more`,
        };
      }

      return { message: `Enter more than ${formatBound(issue.minimum)}` };

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Use at most ${pluralize(issue.maximum, 'character')}` };
      }

      if (issue.type === 'array' || issue.type === 'set') {
        return { message: `Add at most ${formatBound(issue.maximum)}` };
      }

      if (issue.type === 'date') {
        return { message: `Choose a date on or before ${formatBound(issue.maximum)}` };
      }

      return {
        message: issue.inclusive
          ? `Enter ${formatBound(issue.maximum)} or less`
          : `Enter less than ${formatBound(issue.maximum)}`,
      };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'Enter a valid email address' };
      }

      if (issue.validation === 'url') {
        return { message: 'Enter a valid link, starting with https://' };
      }

      if (issue.validation === 'datetime' || issue.validation === 'date') {
        return { message: 'Enter a valid date' };
      }

      return { message: 'Check the format of this value' };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Choose one of the options' };

    case z.ZodIssueCode.invalid_date:
      return { message: 'Enter a valid date' };

    case z.ZodIssueCode.not_multiple_of:
      return { message: 'Enter a whole number' };

    default:
      return { message: 'Check this value' };
  }
};

let installed = false;

/** Makes `zodErrorMap` the fallback for every schema, the shared package's included. */
export function installZodErrorMap() {
  if (installed) {
    return;
  }

  z.setErrorMap(zodErrorMap);
  installed = true;
}
