import { MaintenanceCategory, ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { pickDueCategory, pickFromReminder } from './pick-due-category';
import { reminderWork } from './service-work';

// Noon in India, 23 Sep 2026.
const now = new Date('2026-09-23T06:30:00.000Z');

function reminder(overrides: Partial<Parameters<typeof pickDueCategory>[0][number]>) {
  return {
    type: ReminderType.Service,
    title: 'Engine oil due',
    status: ReminderStatus.Upcoming,
    ...overrides,
  };
}

describe('reminderWork', () => {
  it('knows the work from the schedule item, the record title, then the type', () => {
    expect(reminderWork(reminder({ title: 'Oil', catalogSlug: 'engine_oil_change' }))).toEqual({
      category: MaintenanceCategory.EngineOil,
      phrase: 'the oil change',
    });
    expect(reminderWork(reminder({ title: 'Brake pads due' }))?.category).toBe(
      MaintenanceCategory.BrakePads,
    );
    expect(reminderWork(reminder({ type: ReminderType.TyreRotation, title: 'Rotate' }))).toEqual({
      category: MaintenanceCategory.TyreRotation,
      phrase: 'the tyre rotation',
    });
    expect(reminderWork(reminder({ title: 'Car service' }))).toEqual({
      category: MaintenanceCategory.PeriodicService,
      phrase: '“Car service”',
    });
  });

  it('has none for a renewal', () => {
    expect(reminderWork(reminder({ type: ReminderType.Insurance, title: 'Insurance' }))).toBe(
      undefined,
    );
  });
});

describe('pickDueCategory', () => {
  it('picks the service due today, and says so', () => {
    expect(
      pickDueCategory(
        [reminder({ status: ReminderStatus.DueToday, dueDate: '2026-09-23T00:00:00.000Z' })],
        now,
      ),
    ).toEqual({
      category: MaintenanceCategory.EngineOil,
      reason: 'Picked because the oil change is due today.',
    });
  });

  it('prefers what is late over what is due this week', () => {
    const pick = pickDueCategory(
      [
        reminder({ title: 'Brake pads due', dueDate: '2026-09-26T00:00:00.000Z' }),
        reminder({
          title: 'Coolant due',
          status: ReminderStatus.Overdue,
          dueDate: '2026-09-20T00:00:00.000Z',
        }),
      ],
      now,
    );

    expect(pick).toEqual({
      category: MaintenanceCategory.Coolant,
      reason: 'Picked because the coolant change is 3 days late.',
    });
  });

  it('says a service late by distance was due at a reading', () => {
    expect(
      pickDueCategory(
        [
          reminder({
            status: ReminderStatus.Overdue,
            dueDate: '2027-01-01T00:00:00.000Z',
            dueOdometer: 42_000,
          }),
        ],
        now,
      )?.reason,
    ).toBe('Picked because the oil change was due at 42,000 km.');
  });

  it('counts this week, not later, and never a renewal or a completed one', () => {
    expect(pickDueCategory([reminder({ dueDate: '2026-09-25T00:00:00.000Z' })], now)?.reason).toBe(
      'Picked because the oil change is due in 2 days.',
    );
    expect(pickDueCategory([reminder({ dueDate: '2026-10-15T00:00:00.000Z' })], now)).toBe(null);
    expect(
      pickDueCategory(
        [
          reminder({
            type: ReminderType.Puc,
            title: 'PUC',
            status: ReminderStatus.Overdue,
            dueDate: '2026-09-01T00:00:00.000Z',
          }),
          reminder({ status: ReminderStatus.Completed, dueDate: '2026-09-01T00:00:00.000Z' }),
        ],
        now,
      ),
    ).toBe(null);
  });
});

describe('pickFromReminder', () => {
  it('names the reminder, and lets the address choose the category', () => {
    const oil = reminder({ title: 'Engine oil due' });

    expect(pickFromReminder(oil, undefined)).toEqual({
      category: MaintenanceCategory.EngineOil,
      reason: 'For your reminder “Engine oil due”.',
    });
    expect(pickFromReminder(oil, MaintenanceCategory.PeriodicService)?.category).toBe(
      MaintenanceCategory.PeriodicService,
    );
  });
});
