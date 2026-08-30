import { describe, expect, it } from 'vitest';

import { AccessoryWarrantyExpiringTemplate } from './accessory-warranty-expiring.template';

const template = new AccessoryWarrantyExpiringTemplate();

const accessory = {
  id: 'accessory-1',
  vehicleId: 'vehicle-1',
  name: 'Dashcam',
  brand: '70mai',
  warrantyExpiresAt: new Date('2026-09-04T00:00:00.000Z'),
};

describe('AccessoryWarrantyExpiringTemplate', () => {
  it('collapses every day inside the urgent window onto one dedup key', () => {
    // Otherwise the daily cron raises a fresh unread alert every morning.
    const keys = [1, 3, 7].map((days) => template.dedupKey({ accessory, daysUntilExpiry: days }));

    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('accessory-warranty-expiring:accessory-1:7d');
  });

  it('separates the heads-up window from the urgent one', () => {
    expect(template.dedupKey({ accessory, daysUntilExpiry: 20 })).toContain(':30d');
  });

  it('names the item with its brand and links to the accessories tab', () => {
    const rendered = template.render({ accessory, daysUntilExpiry: 3 });

    expect(rendered.title).toBe('Warranty Expiring Soon: Dashcam');
    expect(rendered.message).toContain('70mai Dashcam');
    expect(rendered.message).toContain('3 days');
    expect(rendered.type).toBe('warning');
    expect(rendered.link).toBe('/vehicles/vehicle-1?tab=accessories');
  });

  it('falls back to the bare name when there is no brand', () => {
    const rendered = template.render({
      accessory: { ...accessory, brand: null },
      daysUntilExpiry: 1,
    });

    expect(rendered.message).toContain('your Dashcam');
    expect(rendered.message).toContain('1 day ');
  });
});
