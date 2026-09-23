import { RegisterSchema } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { installZodErrorMap } from './zod-error-map';

// As main.tsx does. Installed globally, it sits below a schema's own messages;
// passed per parse it would sit above them.
installZodErrorMap();

/** Zod's own wording (3 and 4), which must never reach a form. */
const rawZodText =
  /expected|received|too (small|big)|string must|number must|invalid (input|option|enum|email|url|key|element|string|date)|unrecognized key|character\(s\)|>=|<=/i;

function messageFor(schema: z.ZodType, value: unknown) {
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
    ['an invalid date', z.date(), new Date(Number.NaN), 'Enter a valid date'],
    ['text where a date goes', z.coerce.date(), 'nope', 'Enter a valid date'],
    [
      'a date too early',
      z.date().min(new Date(2020, 0, 1)),
      new Date(2019, 0, 1),
      'Choose a date on or after 1/1/2020',
    ],
    ['an empty list', z.array(z.string()).min(1), [], 'Add at least 1'],
    ['a step that does not fit', z.number().multipleOf(5), 7, 'Enter a whole number'],
  ])('words %s in plain language', (_, schema, value, expected) => {
    const message = messageFor(schema, value);

    expect(message).toBe(expected);
    expect(message).not.toMatch(rawZodText);
  });

  it('never overrides a message the schema gives', () => {
    const schema = z.number({ error: 'Enter the litres' }).positive('Too few');

    expect(messageFor(schema, Number.NaN)).toBe('Enter the litres');
    expect(messageFor(schema, 0)).toBe('Too few');
  });

  // One schema per issue code Zod 4 can raise. A new code, or a Zod upgrade
  // that renames one, lands in the map's default rather than in Zod's words.
  it.each([
    ['invalid_type', z.string(), 42],
    ['too_small', z.number().min(1), 0],
    ['too_big', z.string().max(1), 'ab'],
    ['invalid_format', z.string().regex(/^a$/), 'b'],
    ['not_multiple_of', z.number().multipleOf(2), 3],
    ['unrecognized_keys', z.strictObject({ a: z.string() }), { a: 'x', b: 'y' }],
    ['invalid_union', z.union([z.string(), z.number()]), true],
    ['invalid_key', z.record(z.string().min(2), z.string()), { b: 'x' }],
    ['invalid_value', z.literal('a'), 'b'],
    ['custom', z.string().refine((value) => value === 'a'), 'b'],
  ])('words a %s issue without Zod’s text', (code, schema, value) => {
    const result = schema.safeParse(value);

    expect(result.success).toBe(false);
    const issue = result.success ? undefined : result.error.issues[0];
    expect(issue?.code).toBe(code);
    expect(issue?.message).not.toMatch(rawZodText);
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
