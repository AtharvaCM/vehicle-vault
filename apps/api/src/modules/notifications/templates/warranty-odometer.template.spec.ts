import { describe, expect, it } from 'vitest';

import type { WarrantyOdometerPayload } from '../types';
import { WarrantyOdometerTemplate, warrantyDistancePhase } from './warranty-odometer.template';

const payload = (remainingKm: number): WarrantyOdometerPayload => ({
  warranty: {
    id: 'wty-1',
    vehicleId: 'veh-1',
    provider: 'Hyundai',
    type: 'Manufacturer',
    endOdometer: 100_000,
  },
  remainingKm,
});

describe('WarrantyOdometerTemplate', () => {
  const template = new WarrantyOdometerTemplate();

  it('says how far is left while the limit is ahead', () => {
    const rendered = template.render(payload(420));

    expect(rendered.title).toBe('Warranty Ending Soon: Hyundai');
    expect(rendered.message).toBe(
      'Your manufacturer warranty with Hyundai ends at 1,00,000 km, about 420 km from now. Book any warranty work before you pass it.',
    );
    expect(rendered.link).toBe('/vehicles/veh-1?tab=protection');
  });

  it('says plainly when the limit has been passed', () => {
    const rendered = template.render(payload(-1_200));

    expect(rendered.title).toBe('Warranty Distance Reached: Hyundai');
    expect(rendered.message).toContain('has passed the 1,00,000 km limit');
    expect(rendered.message).toContain('no longer covered');
  });

  it('dedups per warranty and phase, so the daily run says each thing once', () => {
    // Every day inside the window is the same notification…
    expect(template.dedupKey(payload(480))).toBe(template.dedupKey(payload(120)));
    // …passing the limit is a new one…
    expect(template.dedupKey(payload(-5))).not.toBe(template.dedupKey(payload(5)));
    // …and it stays one after that.
    expect(template.dedupKey(payload(-5))).toBe(template.dedupKey(payload(-900)));
    expect(template.dedupKey(payload(120))).toBe('warranty-odometer:wty-1:approaching');
  });

  it('counts reaching the limit exactly as having passed it', () => {
    expect(warrantyDistancePhase(0)).toBe('passed');
    expect(warrantyDistancePhase(1)).toBe('approaching');
  });
});
