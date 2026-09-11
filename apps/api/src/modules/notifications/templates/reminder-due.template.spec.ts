import { describe, expect, it } from 'vitest';

import { ReminderDueTemplate } from './reminder-due.template';

describe('ReminderDueTemplate', () => {
  const template = new ReminderDueTemplate();

  describe('dedupKey', () => {
    it('locks identity to reminderId only — payload variations dedupe together', () => {
      const a = template.dedupKey({
        reminderId: 'rem-1',
        vehicleId: 'veh-1',
        title: 'Service A',
        dueOdometer: 50000,
        remainingDistanceKm: 400,
      });
      const b = template.dedupKey({
        reminderId: 'rem-1',
        vehicleId: 'veh-1',
        title: 'Service A',
        dueOdometer: 50000,
        remainingDistanceKm: 50,
      });
      expect(a).toBe(b);
      expect(a).toBe('reminder-due:rem-1');
    });

    it('differs across reminderIds', () => {
      expect(
        template.dedupKey({
          reminderId: 'rem-1',
          vehicleId: 'veh-1',
          title: 'A',
          dueOdometer: 1000,
          remainingDistanceKm: 100,
        }),
      ).not.toBe(
        template.dedupKey({
          reminderId: 'rem-2',
          vehicleId: 'veh-1',
          title: 'A',
          dueOdometer: 1000,
          remainingDistanceKm: 100,
        }),
      );
    });
  });

  describe('render', () => {
    it('produces a warning-typed alert mentioning the due odometer and remaining distance', () => {
      expect(
        template.render({
          reminderId: 'rem-1',
          vehicleId: 'veh-1',
          title: 'Brake fluid change',
          dueOdometer: 50000,
          remainingDistanceKm: 320.6,
        }),
      ).toEqual({
        title: 'Reminder Due Soon: Brake fluid change',
        message:
          'Your vehicle is approaching 50000km (approx. 321km left) for "Brake fluid change".',
        type: 'warning',
        link: '/vehicles/veh-1?tab=reminders',
      });
    });

    it('keeps the title inside the 120-char Notification.title column', () => {
      // Reminder.title is itself VARCHAR(120) and the prefix is another 19, so
      // an untrimmed title overflows the column — and the cron's per-vehicle
      // catch would drop every remaining alert for that vehicle with it.
      const rendered = template.render({
        reminderId: 'rem-1',
        vehicleId: 'veh-1',
        title: 'x'.repeat(120),
        dueOdometer: 50000,
        remainingDistanceKm: 320,
      });

      expect(rendered.title.length).toBeLessThanOrEqual(120);
      expect(rendered.title.startsWith('Reminder Due Soon: ')).toBe(true);
      expect(rendered.title.endsWith('\u2026')).toBe(true);
      // The message column is TEXT, so the full title still reads in full there.
      expect(rendered.message).toContain('x'.repeat(120));
    });
  });
});
