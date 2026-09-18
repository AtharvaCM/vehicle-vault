import { describe, expect, it } from 'vitest';

import { ServiceBaselineUnknownTemplate } from './service-baseline-unknown.template';

const template = new ServiceBaselineUnknownTemplate();

const categoryPayload = {
  vehicleId: 'vehicle-1',
  odometer: 40_000,
  scope: 'category' as const,
  category: 'brake_pads',
  intervalKm: 30_000,
};

const vehiclePayload = {
  vehicleId: 'vehicle-1',
  odometer: 40_000,
  scope: 'vehicle' as const,
};

describe('ServiceBaselineUnknownTemplate', () => {
  it('re-asks a category no more than once per service interval of travel', () => {
    const first = template.dedupKey(categoryPayload);
    const later = template.dedupKey({ ...categoryPayload, odometer: 55_000 });
    const muchLater = template.dedupKey({ ...categoryPayload, odometer: 61_000 });

    expect(first).toBe('service-baseline-unknown:vehicle-1:brake_pads:1');
    expect(later).toBe(first);
    expect(muchLater).not.toBe(first);
  });

  it('nags about a short interval more often than a long one', () => {
    // Relative urgency falls out of the interval itself rather than a second
    // table of numbers: oil at 7 500 km comes round four times as often as pads.
    const oil = (odometer: number) =>
      template.dedupKey({
        ...categoryPayload,
        category: 'engine_oil',
        intervalKm: 7_500,
        odometer,
      });

    expect(oil(40_000)).not.toBe(oil(48_000));
    expect(template.dedupKey(categoryPayload)).toBe(
      template.dedupKey({ ...categoryPayload, odometer: 48_000 }),
    );
  });

  it('keeps the whole-vehicle prompt on its own key', () => {
    expect(template.dedupKey(vehiclePayload)).toBe('service-baseline-unknown:vehicle-1:vehicle:4');
    expect(template.dedupKey(vehiclePayload)).not.toBe(template.dedupKey(categoryPayload));
  });

  it('names the category and says why no reminder exists for it', () => {
    const rendered = template.render(categoryPayload);

    expect(rendered.title).toBe('Unknown Service History: Brake Pads');
    expect(rendered.message).toContain('brake pads');
    expect(rendered.message).toContain('no reminder can be timed against it');
    expect(rendered.link).toBe('/vehicles/vehicle-1?tab=maintenance');
  });

  it('admits what the fallback assumes when the whole history is missing', () => {
    // The honest sentence: silence here is not "nothing is due", it is the app
    // guessing from the day the vehicle was added.
    const rendered = template.render(vehiclePayload);

    expect(rendered.title).toBe('Add This Vehicle’s Service History');
    expect(rendered.message).toContain('40,000 km');
    expect(rendered.message).toContain('assumes everything had just been done');
  });

  it('stays informational — a gap in knowledge is not a fault', () => {
    expect(template.render(categoryPayload).type).toBe('info');
    expect(template.render(vehiclePayload).type).toBe('info');
  });

  describe('cooldownKey', () => {
    it('ignores the odometer, so a later bucket is still the same prompt', () => {
      expect(template.cooldownKey({ ...vehiclePayload, odometer: 40_000 })).toBe(
        template.cooldownKey({ ...vehiclePayload, odometer: 95_000 }),
      );
    });

    it('is a prefix of the dedup key, which is what the cooldown lookup relies on', () => {
      for (const payload of [vehiclePayload, categoryPayload]) {
        expect(template.dedupKey(payload).startsWith(template.cooldownKey(payload))).toBe(true);
      }
    });

    it('keeps the vehicle prompt and a category alert apart', () => {
      expect(template.cooldownKey(vehiclePayload)).not.toBe(template.cooldownKey(categoryPayload));
      expect(
        template.dedupKey(categoryPayload).startsWith(template.cooldownKey(vehiclePayload)),
      ).toBe(false);
    });
  });
});
