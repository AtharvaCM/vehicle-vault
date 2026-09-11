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

    it('keeps the title inside the 120-char Notification.title column', () => {
      // Reminder.title is itself VARCHAR(120) and the prefix is another 18.
      const rendered = template.render({
        reminderId: 'rem-9',
        vehicleId: 'veh-1',
        title: 'x'.repeat(120),
        dueOdometer: 25000,
        remainingDistanceKm: -120,
      });

      expect(rendered.title.length).toBeLessThanOrEqual(120);
      expect(rendered.title.startsWith('Overdue Reminder: ')).toBe(true);
      expect(rendered.title.endsWith('\u2026')).toBe(true);
      expect(rendered.message).toContain('x'.repeat(120));
    });
  });
});
