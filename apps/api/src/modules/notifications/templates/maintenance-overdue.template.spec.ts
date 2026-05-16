import { describe, expect, it } from 'vitest';

import { MaintenanceOverdueTemplate } from './maintenance-overdue.template';

describe('MaintenanceOverdueTemplate', () => {
  const template = new MaintenanceOverdueTemplate();

  describe('dedupKey', () => {
    it('locks identity to (vehicleId, category)', () => {
      const a = template.dedupKey({
        vehicleId: 'veh-1',
        category: 'engine_oil',
        remainingDistanceKm: -120,
      });
      const b = template.dedupKey({
        vehicleId: 'veh-1',
        category: 'engine_oil',
        remainingDistanceKm: -800,
      });
      expect(a).toBe(b);
      expect(a).toBe('maintenance-overdue:veh-1:engine_oil');
    });

    it('differs from maintenance-due for the same vehicle + category', () => {
      expect(
        template.dedupKey({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: -50,
        }),
      ).toBe('maintenance-overdue:veh-1:engine_oil');
    });
  });

  describe('render', () => {
    it('produces an error-typed alert with absolute overdue distance', () => {
      expect(
        template.render({
          vehicleId: 'veh-1',
          category: 'engine_oil',
          remainingDistanceKm: -423.7,
        }),
      ).toEqual({
        title: 'Overdue Service: Engine Oil',
        message:
          'Your Engine Oil is overdue by approx. 424 km. Please schedule service soon.',
        type: 'error',
        link: '/vehicles/veh-1?tab=maintenance',
      });
    });

    it('Title-Cases multi-word snake_case categories', () => {
      expect(
        template.render({
          vehicleId: 'veh-1',
          category: 'wheel_alignment',
          remainingDistanceKm: -250,
        }).title,
      ).toBe('Overdue Service: Wheel Alignment');
    });
  });
});
