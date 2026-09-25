import { MaintenanceCategory, ReminderType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { logServiceSearchFor, reminderDoneAction } from './reminder-done';
import { describeWhatDoneDoes } from './what-done-does';

const base = { id: 'reminder-1', vehicleId: 'vehicle-1' };

describe('reminderDoneAction', () => {
  it('sends a renewal that follows a paper to Renew, even when it names a category', () => {
    expect(
      reminderDoneAction({
        ...base,
        logCategory: MaintenanceCategory.Puc,
        renewsDocument: { kind: 'puc', id: 'paper-1' },
      }),
    ).toBe('renew');
  });

  it('asks to log a reminder for work on the vehicle, and ticks off anything else', () => {
    expect(reminderDoneAction({ ...base, logCategory: MaintenanceCategory.EngineOil })).toBe('log');
    expect(reminderDoneAction(base)).toBe('complete');
  });
});

describe('logServiceSearchFor', () => {
  it('names the category and the reminder the record answers', () => {
    expect(logServiceSearchFor({ ...base, logCategory: MaintenanceCategory.Battery })).toEqual({
      category: 'battery',
      reminderId: 'reminder-1',
    });
    expect(logServiceSearchFor(base)).toEqual({ reminderId: 'reminder-1' });
  });
});

describe('describeWhatDoneDoes', () => {
  const reminder = {
    type: ReminderType.Service,
    catalogSlug: undefined,
    repeatEveryMonths: undefined,
    repeatEveryKm: undefined,
    logCategory: undefined,
    renewsDocument: undefined,
  };

  it('says a logged service is what the next one counts from', () => {
    expect(
      describeWhatDoneDoes({
        ...reminder,
        repeatEveryKm: 10000,
        repeatEveryMonths: 12,
        logCategory: MaintenanceCategory.EngineOil,
      }),
    ).toBe(
      'Repeats every 10,000 km or 12 months; the next one will be counted from the service you log.',
    );
  });

  it('says what the other rules count from', () => {
    expect(
      describeWhatDoneDoes({ ...reminder, type: ReminderType.Custom, repeatEveryMonths: 6 }),
    ).toBe('Repeats every 6 months; the next one is counted from the day you mark it done.');
    expect(
      describeWhatDoneDoes({ ...reminder, type: ReminderType.Puc, repeatEveryMonths: 12 }),
    ).toBe(
      'Repeats every year; the next one keeps its cycle, counted from this due date (or from the day you mark it done, if that is later).',
    );
    expect(
      describeWhatDoneDoes({
        ...reminder,
        type: ReminderType.Inspection,
        catalogSlug: 'tyre_inspection',
        repeatEveryKm: 5000,
      }),
    ).toBe('Repeats every 5,000 km; the next one is counted from your last tyre reading.');
  });

  it('says a one-off closes, and leaves a paper’s renewal to its own line', () => {
    expect(describeWhatDoneDoes({ ...reminder, logCategory: MaintenanceCategory.Battery })).toBe(
      'Doesn’t repeat: logging the service closes it.',
    );
    expect(describeWhatDoneDoes({ ...reminder, type: ReminderType.Custom })).toBe(
      'Doesn’t repeat: marking it done closes it.',
    );
    expect(
      describeWhatDoneDoes({
        ...reminder,
        type: ReminderType.Insurance,
        renewsDocument: { kind: 'insurance', id: 'paper-1' },
      }),
    ).toBeNull();
  });
});
