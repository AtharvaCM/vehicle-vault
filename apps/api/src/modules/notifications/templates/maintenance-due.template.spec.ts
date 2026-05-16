import { describe, expect, it } from 'vitest';

import { MaintenanceDueTemplate } from './maintenance-due.template';

describe('MaintenanceDueTemplate', () => {
  const template = new MaintenanceDueTemplate();

  describe('dedupKey', () => {
    it('locks identity to (vehicleId, category) — same payload twice produces the same key', () => {
      const a = template.dedupKey({
        vehicleId: 'veh-1',
        category: 'engine_oil',
        remainingDistanceKm: 480,
      });
      const b = template.dedupKey({
        vehicleId: 'veh-1',
        category: 'engine_oil',
        remainingDistanceKm: 120,
      });
      expect(a).toBe(b);
      expect(a).toBe('maintenance-due:veh-1:engine_oil');
    });

    it('differs across categories on the same vehicle', () => {
      expect(
        template.dedupKey({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: 200,
        }),
      ).not.toBe(
        template.dedupKey({
          vehicleId: 'veh-1',
          category: 'brake_pads',
          remainingDistanceKm: 200,
        }),
      );
    });

    it('differs across vehicles for the same category', () => {
      expect(
        template.dedupKey({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: 200,
        }),
      ).not.toBe(
        template.dedupKey({
          vehicleId: 'veh-2',
          category: 'engine_oil',
          remainingDistanceKm: 200,
        }),
      );
    });
  });

  describe('render', () => {
    it('produces the expected title, message, type, and link', () => {
      expect(
        template.render({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: 423.7,
        }),
      ).toEqual({
        title: 'Service Due Soon: Engine Oil',
        message:
          'Your Engine Oil is due in approx. 424 km. Time to plan a visit to the workshop.',
        type: 'warning',
        link: '/vehicles/veh-1?tab=maintenance',
      });
    });

    it('Title-Cases multi-word snake_case categories', () => {
      expect(
        template.render({
          vehicleId: 'veh-1',
          category: 'wheel_alignment',
          remainingDistanceKm: 250,
        }).title,
      ).toBe('Service Due Soon: Wheel Alignment');
    });

    it('rounds remaining distance to the nearest integer', () => {
      expect(
        template.render({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: 0.4,
        }).message,
      ).toContain('0 km');
      expect(
        template.render({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: 99.6,
        }).message,
      ).toContain('100 km');
    });
  });
});
