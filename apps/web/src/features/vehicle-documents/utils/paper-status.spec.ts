import { describe, expect, it } from 'vitest';

import { paperStatus, warrantyTypeLabel } from './paper-status';

const now = new Date('2026-09-26T00:00:00.000Z');

describe('paperStatus', () => {
  it('reads an end date in the past as expired', () => {
    expect(paperStatus('2026-09-20T00:00:00.000Z', now)).toBe('expired');
  });

  it('reads one within 30 days as ending soon', () => {
    expect(paperStatus('2026-10-10T00:00:00.000Z', now)).toBe('ends-soon');
  });

  it('reads a later one, or none at all, as valid', () => {
    expect(paperStatus('2027-03-01T00:00:00.000Z', now)).toBe('valid');
    expect(paperStatus(null, now)).toBe('valid');
  });
});

describe('warrantyTypeLabel', () => {
  it('names a raw or form-written type in the form’s own words', () => {
    expect(warrantyTypeLabel('manufacturer')).toBe('Manufacturer');
    expect(warrantyTypeLabel('Parts')).toBe('Parts only');
    expect(warrantyTypeLabel('powertrain_only')).toBe('Powertrain only');
  });

  it('has nothing to say about a missing type', () => {
    expect(warrantyTypeLabel(undefined)).toBeNull();
    expect(warrantyTypeLabel('  ')).toBeNull();
  });
});
