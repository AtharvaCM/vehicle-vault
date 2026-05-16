import { describe, expect, it } from 'vitest';

import { ReminderOverdueTemplate } from './reminder-overdue.template';

describe('ReminderOverdueTemplate', () => {
  const template = new ReminderOverdueTemplate();

  describe('dedupKey', () => {
    it('locks identity to reminderId', () => {
      const key = template.dedupKey({
        reminderId: 'rem-9',
        vehicleId: 'veh-1',
        title: 'Tyre rotation',
        dueOdometer: 25000,
        remainingDistanceKm: -150,
      });
      expect(key).toBe('reminder-overdue:rem-9');
    });

    it('differs from reminder-due for the same reminder', () => {
      expect(
        template.dedupKey({
          reminderId: 'rem-9',
          vehicleId: 'veh-1',
          title: 'X',
          dueOdometer: 0,
          remainingDistanceKm: -10,
        }),
      ).toBe('reminder-overdue:rem-9');
    });
  });

  describe('render', () => {
    it('produces an error-typed alert mentioning the missed odometer mark', () => {
      expect(
        template.render({
          reminderId: 'rem-9',
          vehicleId: 'veh-1',
          title: 'Tyre rotation',
          dueOdometer: 25000,
          remainingDistanceKm: -120,
        }),
      ).toEqual({
        title: 'Overdue Reminder: Tyre rotation',
        message:
          'Your vehicle has passed the 25000km mark set for "Tyre rotation". Please attend to this task.',
        type: 'error',
        link: '/vehicles/veh-1?tab=reminders',
      });
    });
  });
});
