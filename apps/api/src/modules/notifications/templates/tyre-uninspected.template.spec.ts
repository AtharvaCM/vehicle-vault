import { describe, expect, it } from 'vitest';

import { TyreUninspectedTemplate } from './tyre-uninspected.template';

const template = new TyreUninspectedTemplate();

describe('TyreUninspectedTemplate', () => {
  it('holds one nudge per inspection interval of travel', () => {
    // Keyed to an absence rather than to a state change, so without the
    // odometer bucket this re-raises every morning the user leaves it unread.
    const first = template.dedupKey({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'untracked',
    });
    const later = template.dedupKey({
      vehicleId: 'vehicle-1',
      odometer: 42_400,
      reason: 'untracked',
    });

    expect(first).toBe('tyre-uninspected:vehicle-1:untracked:8');
    expect(later).toBe(first);
  });

  it('nudges again once the vehicle has covered another interval', () => {
    expect(
      template.dedupKey({ vehicleId: 'vehicle-1', odometer: 45_000, reason: 'untracked' }),
    ).toBe('tyre-uninspected:vehicle-1:untracked:9');
  });

  it('keeps the two causes on separate keys', () => {
    const untracked = template.dedupKey({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'untracked',
    });
    const stale = template.dedupKey({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'stale',
      kmSinceLastCheck: 6_000,
      daysSinceLastCheck: 210,
    });

    expect(stale).not.toBe(untracked);
  });

  it('asks an untracked vehicle for its fitted set', () => {
    const rendered = template.render({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'untracked',
    });

    expect(rendered.title).toBe('Tyres Not Tracked');
    expect(rendered.message).toContain('40,000 km');
    expect(rendered.message).toContain('no tyres recorded');
    expect(rendered.link).toBe('/vehicles/vehicle-1?tab=tyres');
  });

  it('asks a tracked vehicle for a fresh reading, in both units', () => {
    const rendered = template.render({
      vehicleId: 'vehicle-1',
      odometer: 46_200,
      reason: 'stale',
      kmSinceLastCheck: 6_200,
      daysSinceLastCheck: 210,
    });

    expect(rendered.title).toBe('Time to Check the Tyres');
    expect(rendered.message).toContain('6,200 km');
    expect(rendered.message).toContain('210 days');
  });

  it('stays informational — an absence of data is not a fault', () => {
    // Overstating "nobody has looked" as a warning is how a safety alert
    // becomes something people learn to swipe away.
    const untracked = template.render({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'untracked',
    });
    const stale = template.render({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'stale',
      kmSinceLastCheck: 6_000,
      daysSinceLastCheck: 1,
    });

    expect(untracked.type).toBe('info');
    expect(stale.type).toBe('info');
    expect(stale.message).toContain('1 day ');
  });
});
