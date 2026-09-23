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

/** A value that never reached the schema: an empty number input reads as NaN. */
function isMissing(input: unknown) {
  return input === undefined || input === null || Number.isNaN(input);
}

/**
 * The words every form falls back on when a schema gives no message of its own.
 * Zod's defaults ("Invalid input: expected number, received NaN", "Too small:
 * expected string to have >=8 characters") read like a crash to someone logging
 * a fill at the pump, and a schema message always wins over this map, so a field
 * that knows better ("Enter the litres") still says so.
 */
export const zodErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      // An empty number input reaches the schema as NaN or undefined: it is missing, not wrong.
      if (isMissing(issue.input)) {
        return 'This field is required';
      }

      // `.int()` reports a decimal as a type error, expecting "int".
      if (issue.expected === 'int') {
        return 'Enter a whole number';
      }

      if (issue.expected === 'number') {
        return 'Enter a number';
      }

      if (issue.expected === 'date') {
        return 'Enter a valid date';
      }

      return 'Check this value';

    case 'too_small':
      if (issue.origin === 'string') {
        return Number(issue.minimum) <= 1
          ? 'This field is required'
          : `Use at least ${pluralize(issue.minimum, 'character')}`;
      }

      if (issue.origin === 'array' || issue.origin === 'set') {
        return `Add at least ${formatBound(issue.minimum)}`;
      }

      if (issue.origin === 'date') {
        return `Choose a date on or after ${formatBound(new Date(Number(issue.minimum)))}`;
      }

      if (issue.inclusive) {
        return Number(issue.minimum) === 0
          ? 'Enter 0 or more'
          : `Enter ${formatBound(issue.minimum)} or more`;
      }

      return `Enter more than ${formatBound(issue.minimum)}`;

    case 'too_big':
      if (issue.origin === 'string') {
        return `Use at most ${pluralize(issue.maximum, 'character')}`;
      }

      if (issue.origin === 'array' || issue.origin === 'set') {
        return `Add at most ${formatBound(issue.maximum)}`;
      }

      if (issue.origin === 'date') {
        return `Choose a date on or before ${formatBound(new Date(Number(issue.maximum)))}`;
      }

      return issue.inclusive
        ? `Enter ${formatBound(issue.maximum)} or less`
        : `Enter less than ${formatBound(issue.maximum)}`;

    case 'invalid_format':
      if (issue.format === 'email') {
        return 'Enter a valid email address';
      }

      if (issue.format === 'url') {
        return 'Enter a valid link, starting with https://';
      }

      if (issue.format === 'datetime' || issue.format === 'date') {
        return 'Enter a valid date';
      }

      return 'Check the format of this value';

    case 'invalid_value':
      return 'Choose one of the options';

    case 'not_multiple_of':
      return 'Enter a whole number';

    default:
      return 'Check this value';
  }
};

let installed = false;

/** Makes `zodErrorMap` the fallback for every schema, the shared package's included. */
export function installZodErrorMap() {
  if (installed) {
    return;
  }

  z.config({ customError: zodErrorMap });
  installed = true;
}
