import { describe, expect, it } from 'vitest';

import { NOTIFICATION_TITLE_MAX_LENGTH, prefixedTitle, truncate } from './notification-title';

describe('truncate', () => {
  it('leaves a value that already fits untouched', () => {
    expect(truncate('Brake fluid change', 40)).toBe('Brake fluid change');
  });

  it('leaves a value sitting exactly on the budget untouched', () => {
    expect(truncate('x'.repeat(40), 40)).toBe('x'.repeat(40));
  });

  it('spends the last character on an ellipsis when it has to cut', () => {
    expect(truncate('x'.repeat(41), 40)).toBe(`${'x'.repeat(39)}…`);
  });
});

describe('prefixedTitle', () => {
  it('keeps the prefix whole and trims only the subject', () => {
    const title = prefixedTitle('Reminder Due Soon: ', 'x'.repeat(200));

    expect(title.startsWith('Reminder Due Soon: ')).toBe(true);
    expect(title).toHaveLength(NOTIFICATION_TITLE_MAX_LENGTH);
    expect(title.endsWith('…')).toBe(true);
  });

  it('does not pad or alter a subject that fits', () => {
    expect(prefixedTitle('Overdue Reminder: ', 'Insurance')).toBe('Overdue Reminder: Insurance');
  });
});
