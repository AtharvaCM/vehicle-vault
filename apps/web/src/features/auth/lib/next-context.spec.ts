import { describe, expect, it } from 'vitest';

import { nextContext } from './next-context';

describe('nextContext', () => {
  it('says nothing for an ordinary sign-in', () => {
    expect(nextContext(undefined)).toBeNull();
    expect(nextContext('')).toBeNull();
  });

  it('names what the return path is for', () => {
    expect(nextContext('/vehicle-invites/abc123')).toBe('to accept your vehicle invite');
    expect(nextContext('/reminders/r1?from=email')).toBe('to open that reminder');
    expect(nextContext('/maintenance-records/m1')).toBe('to open that service record');
    expect(nextContext('/vehicles/new?make=honda')).toBe('to add your vehicle');
    expect(nextContext('/vehicles/v1?tab=history')).toBe('to open that vehicle');
    expect(nextContext('/settings/preferences')).toBe('to open your settings');
  });

  it('falls back to a general line for any other page', () => {
    expect(nextContext('/costs#fuel')).toBe('to carry on where you were');
  });
});
