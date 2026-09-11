import { describe, expect, it } from 'vitest';

import { ReminderOverdueTemplate } from './reminder-overdue.template';
import type { ReminderOverduePayload } from '../types';

describe('ReminderOverdueTemplate', () => {
  const template = new ReminderOverdueTemplate();

  const odometerPayload = (
    overrides: Partial<ReminderOverduePayload> = {},
  ): ReminderOverduePayload => ({
    reminderId: 'rem-9',
    vehicleId: 'veh-1',
    title: 'Tyre rotation',
    basis: 'odometer',
    dueOdometer: 25_000,
    remainingDistanceKm: -150,
    ...overrides,
  });

  const datePayload = (
    overrides: Partial<ReminderOverduePayload> = {},
  ): ReminderOverduePayload => ({
    reminderId: 'rem-9',
    vehicleId: 'veh-1',
    title: 'PUC renewal',
    basis: 'date',
    dueDate: new Date('2026-09-05T00:00:00.000Z'),
    daysUntilDue: -6,
    ...overrides,
  });

  describe('dedupKey', () => {
    it('locks identity to reminderId', () => {
      expect(template.dedupKey(odometerPayload())).toBe('reminder-overdue:rem-9');
    });

    it('is the same key whichever basis produced the alert', () => {
      expect(template.dedupKey(datePayload())).toBe(template.dedupKey(odometerPayload()));
    });

    it('does not move as the reminder falls further behind', () => {
      // Otherwise every morning of a missed reminder would be a fresh unread row.
      expect(template.dedupKey(datePayload({ daysUntilDue: -1 }))).toBe(
        template.dedupKey(datePayload({ daysUntilDue: -40 })),
      );
    });
  });

  describe('render', () => {
    it('produces an error-typed alert mentioning the missed odometer mark', () => {
      expect(template.render(odometerPayload({ remainingDistanceKm: -120 }))).toEqual({
        title: 'Overdue Reminder: Tyre rotation',
        message:
          'Your vehicle has passed the 25000km mark set for "Tyre rotation". Please attend to this task.',
        type: 'error',
        link: '/vehicles/veh-1?tab=reminders',
      });
    });

    it('states the missed date and how long ago, with no km anywhere', () => {
      const rendered = template.render(datePayload());

      expect(rendered).toEqual({
        title: 'Overdue Reminder: PUC renewal',
        message: '"PUC renewal" was due on 5 Sept 2026, 6 days ago. Please attend to this task.',
        type: 'error',
        link: '/vehicles/veh-1?tab=reminders',
      });
      expect(rendered.message).not.toMatch(/km/i);
    });

    it('does not pluralise a single day', () => {
      expect(template.render(datePayload({ daysUntilDue: -1 })).message).toContain('1 day ago');
    });

    it('keeps the title inside the 120-char Notification.title column', () => {
      // Reminder.title is itself VARCHAR(120) and the prefix is another 18.
      for (const payload of [
        odometerPayload({ title: 'x'.repeat(120) }),
        datePayload({ title: 'x'.repeat(120) }),
      ]) {
        const rendered = template.render(payload);

        expect(rendered.title.length).toBeLessThanOrEqual(120);
        expect(rendered.title.startsWith('Overdue Reminder: ')).toBe(true);
        expect(rendered.title.endsWith('\u2026')).toBe(true);
        expect(rendered.message).toContain('x'.repeat(120));
      }
    });
  });
});
