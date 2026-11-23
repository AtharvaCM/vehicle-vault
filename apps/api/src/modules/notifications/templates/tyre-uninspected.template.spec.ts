import { describe, expect, it } from 'vitest';

import { TyreUninspectedTemplate } from './tyre-uninspected.template';

const template = new TyreUninspectedTemplate();

const stalePayload = (
  overrides: Partial<{
    trigger: 'wear' | 'time';
    measured: boolean;
    kmSinceLastCheck: number;
    daysSinceLastCheck: number;
    projectedTreadMm: number;
  }> = {},
) => ({
  vehicleId: 'vehicle-1',
  odometer: 40_000,
  reason: 'stale' as const,
  trigger: 'wear' as const,
  measured: true,
  kmSinceLastCheck: 6_000,
  daysSinceLastCheck: 210,
  projectedTreadMm: 4,
  ...overrides,
});

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
    const stale = template.dedupKey(stalePayload());

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

  it('gives the wear estimate it wants checked, with the distance and days since the reading', () => {
    const rendered = template.render(
      stalePayload({ kmSinceLastCheck: 6_200, daysSinceLastCheck: 210, projectedTreadMm: 4.5 }),
    );

    expect(rendered.title).toBe('Time to Check the Tyres');
    expect(rendered.message).toContain('about 4.5 mm');
    expect(rendered.message).toContain('6,200 km and 210 days after the last reading');
  });

  it('never calls a tyre nobody has measured "last measured"', () => {
    // A new car's set, fitted at delivery and never gauged: the fitting is not
    // a reading, and saying so is the whole point of the message.
    const rendered = template.render(
      stalePayload({
        measured: false,
        trigger: 'time',
        kmSinceLastCheck: 14_000,
        daysSinceLastCheck: 366,
        projectedTreadMm: 6,
      }),
    );

    expect(rendered.message).toContain('not been looked at since they were fitted');
    expect(rendered.message).toContain('14,000 km and 366 days ago');
    expect(rendered.message).not.toContain('last measured');
  });

  it('gives an unmeasured set the typical-wear estimate', () => {
    const rendered = template.render(
      stalePayload({ measured: false, trigger: 'wear', projectedTreadMm: 5 }),
    );

    expect(rendered.message).toContain('not been measured since they were fitted');
    expect(rendered.message).toContain('near 5.0 mm');
  });

  it('asks for the yearly look at a measured set without inventing wear', () => {
    const rendered = template.render(
      stalePayload({ trigger: 'time', kmSinceLastCheck: 900, daysSinceLastCheck: 370 }),
    );

    expect(rendered.message).toContain('for a year');
    expect(rendered.message).toContain('cuts or bulges');
    expect(rendered.message).not.toContain('mm');
  });

  it('stays informational — an absence of data is not a fault', () => {
    // Overstating "nobody has looked" as a warning is how a safety alert
    // becomes something people learn to swipe away.
    const untracked = template.render({
      vehicleId: 'vehicle-1',
      odometer: 40_000,
      reason: 'untracked',
    });
    const stale = template.render(stalePayload({ trigger: 'time', daysSinceLastCheck: 1 }));

    expect(untracked.type).toBe('info');
    expect(stale.type).toBe('info');
    expect(stale.message).toContain('1 day ');
  });

  describe('cooldownKey', () => {
    const untracked = { vehicleId: 'vehicle-1', odometer: 40_000, reason: 'untracked' as const };
    const stale = stalePayload({ daysSinceLastCheck: 40 });

    it('ignores the odometer, so a later bucket is still the same prompt', () => {
      expect(template.cooldownKey(untracked)).toBe(
        template.cooldownKey({ ...untracked, odometer: 90_000 }),
      );
    });

    it('is a prefix of the dedup key, which is what the cooldown lookup relies on', () => {
      for (const payload of [untracked, stale]) {
        expect(template.dedupKey(payload).startsWith(template.cooldownKey(payload))).toBe(true);
      }
    });

    it('keeps "no tyres on file" and "tyres not measured lately" apart', () => {
      expect(template.dedupKey(stale).startsWith(template.cooldownKey(untracked))).toBe(false);
    });
  });
});
