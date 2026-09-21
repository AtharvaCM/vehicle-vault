import { describe, expect, it } from 'vitest';

import { parseOptions } from './purge-test-accounts';

describe('purge-test-accounts options', () => {
  it('dry-runs by default', () => {
    expect(parseOptions([])).toEqual({ execute: false, ids: [] });
  });

  it('deletes only the ids it is given', () => {
    expect(parseOptions(['--execute', '--ids=a, b,,c'])).toEqual({
      execute: true,
      ids: ['a', 'b', 'c'],
    });
  });

  it('refuses to execute without a reviewed list of ids', () => {
    expect(() => parseOptions(['--execute'])).toThrow(/--ids/);
  });

  it('refuses ids without --execute, so a dry run cannot be mistaken for one', () => {
    expect(() => parseOptions(['--ids=a'])).toThrow(/--execute/);
  });
});
