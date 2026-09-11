import { describe, expect, it } from 'vitest';

import { ReminderDueTemplate } from './reminder-due.template';
import type { ReminderDuePayload } from '../types';

describe('ReminderDueTemplate', () => {
  const template = new ReminderDueTemplate();

  const odometerPayload = (overrides: Partial<ReminderDuePayload> = {}): ReminderDuePayload => ({
    reminderId: 'rem-1',
    vehicleId: 'veh-1',
    title: 'Service A',
    basis: 'odometer',
    dueOdometer: 50_000,
    remainingDistanceKm: 400,
    ...overrides,
  });

  const datePayload = (overrides: Partial<ReminderDuePayload> = {}): ReminderDuePayload => ({
    reminderId: 'rem-1',
    vehicleId: 'veh-1',
    title: 'Insurance renewal',
    basis: 'date',
    dueDate: new Date('2026-09-15T00:00:00.000Z'),
    daysUntilDue: 3,
    ...overrides,
  });

  describe('dedupKey', () => {
    it('locks identity to reminderId only — payload variations dedupe together', () => {
      const a = template.dedupKey(odometerPayload({ remainingDistanceKm: 400 }));
      const b = template.dedupKey(odometerPayload({ remainingDistanceKm: 50 }));
      expect(a).toBe(b);
      expect(a).toBe('reminder-due:rem-1');
    });

    it('differs across reminderIds', () => {
      expect(template.dedupKey(odometerPayload({ reminderId: 'rem-1' }))).not.toBe(
        template.dedupKey(odometerPayload({ reminderId: 'rem-2' })),
      );
    });

    it('is the same key whichever basis produced the alert', () => {
      // One task, one unread row. A reminder carrying both a date and an
      // odometer must not be able to leave two "this is due" notifications.
      expect(template.dedupKey(datePayload())).toBe(template.dedupKey(odometerPayload()));
    });

    it('does not move as the days count down, so a daily cron stays idempotent', () => {
      expect(template.dedupKey(datePayload({ daysUntilDue: 7 }))).toBe(
        template.dedupKey(datePayload({ daysUntilDue: 1 })),
      );
    });
  });

  describe('render', () => {
    it('produces a warning-typed alert mentioning the due odometer and remaining distance', () => {
      expect(
        template.render(
          odometerPayload({ title: 'Brake fluid change', remainingDistanceKm: 320.6 }),
        ),
      ).toEqual({
        title: 'Reminder Due Soon: Brake fluid change',
        message:
          'Your vehicle is approaching 50000km (approx. 321km left) for "Brake fluid change".',
        type: 'warning',
        link: '/vehicles/veh-1?tab=reminders',
      });
    });

    it('states the due date and the days left, with no km anywhere, for a dated reminder', () => {
      const rendered = template.render(datePayload());

      expect(rendered).toEqual({
        title: 'Reminder Due Soon: Insurance renewal',
        message: '"Insurance renewal" is due in 3 days on 15 Sept 2026.',
        type: 'warning',
        link: '/vehicles/veh-1?tab=reminders',
      });
      expect(rendered.message).not.toMatch(/km/i);
    });

    it('says "today" rather than "in 0 days"', () => {
      expect(template.render(datePayload({ daysUntilDue: 0 })).message).toBe(
        '"Insurance renewal" is due today, 15 Sept 2026.',
      );
    });

    it('does not pluralise a single day', () => {
      expect(template.render(datePayload({ daysUntilDue: 1 })).message).toContain('in 1 day on');
    });

    it('keeps the title inside the 120-char Notification.title column', () => {
      // Reminder.title is itself VARCHAR(120) and the prefix is another 19, so
      // an untrimmed title overflows the column — and the cron's per-vehicle
      // catch would drop every remaining alert for that vehicle with it.
      for (const payload of [
        odometerPayload({ title: 'x'.repeat(120) }),
        datePayload({ title: 'x'.repeat(120) }),
      ]) {
        const rendered = template.render(payload);

        expect(rendered.title.length).toBeLessThanOrEqual(120);
        expect(rendered.title.startsWith('Reminder Due Soon: ')).toBe(true);
        expect(rendered.title.endsWith('\u2026')).toBe(true);
        // The message column is TEXT, so the title still reads in full there.
        expect(rendered.message).toContain('x'.repeat(120));
      }
    });
  });
});
