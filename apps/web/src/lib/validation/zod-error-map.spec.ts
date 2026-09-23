import { RegisterSchema } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { installZodErrorMap } from './zod-error-map';

// As main.tsx does. Installed globally, it sits below a schema's own messages;
// passed per parse it would sit above them.
installZodErrorMap();

/** Zod's own wording, which must never reach a form. */
const rawZodText =
  /Expected|received|String must|Number must|Invalid (input|enum|email|url)|character\(s\)/;

function messageFor(schema: z.ZodTypeAny, value: unknown) {
  const result = schema.safeParse(value);

  expect(result.success).toBe(false);

  return result.success ? '' : result.error.issues[0]!.message;
}

describe('zodErrorMap', () => {
  it.each([
    ['an empty number input (NaN)', z.number(), Number.NaN, 'This field is required'],
    ['a missing value', z.string(), undefined, 'This field is required'],
    ['text where a number goes', z.number(), 'abc', 'Enter a number'],
    ['a decimal where a whole number goes', z.number().int(), 1.5, 'Enter a whole number'],
    ['an empty required string', z.string().min(1), '', 'This field is required'],
    ['a short password', z.string().min(8), 'abc', 'Use at least 8 characters'],
    ['a long name', z.string().max(120), 'x'.repeat(121), 'Use at most 120 characters'],
    ['a negative amount', z.number().nonnegative(), -1, 'Enter 0 or more'],
    ['a zero reading', z.number().positive(), 0, 'Enter more than 0'],
    ['a large number', z.number().max(100_000), 250_000, 'Enter 1,00,000 or less'],
    ['a bad email', z.string().email(), 'nope', 'Enter a valid email address'],
    ['a bad link', z.string().url(), 'nope', 'Enter a valid link, starting with https://'],
    ['a bad timestamp', z.string().datetime(), 'nope', 'Enter a valid date'],
    ['a value outside an enum', z.enum(['a', 'b']), 'c', 'Choose one of the options'],
  ])('words %s in plain language', (_, schema, value, expected) => {
    const message = messageFor(schema, value);

    expect(message).toBe(expected);
    expect(message).not.toMatch(rawZodText);
  });

  it('never overrides a message the schema gives', () => {
    const schema = z.number({ invalid_type_error: 'Enter the litres' }).positive('Too few');

    expect(messageFor(schema, Number.NaN)).toBe('Enter the litres');
    expect(messageFor(schema, 0)).toBe('Too few');
  });

  it('is installed for the shared package schemas too', () => {
    // Shared resolves the same zod instance: a short password reads as a person
    // would say it.
    const result = RegisterSchema.safeParse({
      name: 'Asha',
      email: 'asha@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues[0]!.message).toBe('Use at least 8 characters');
  });
});
