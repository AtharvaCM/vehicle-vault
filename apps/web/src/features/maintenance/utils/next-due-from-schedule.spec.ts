import { describe, expect, it } from 'vitest';

import {
  addMonthsToDateInput,
  nextDueFromSchedule,
  scheduledNextDue,
} from './next-due-from-schedule';

const oil = { km: 10_000, months: 12, source: 'default' as const };

describe('addMonthsToDateInput', () => {
  it('moves a date on by calendar months, rolling a missing day over as the API does', () => {
    expect(addMonthsToDateInput('2026-09-23', 12)).toBe('2027-09-23');
    expect(addMonthsToDateInput('2026-11-30', 3)).toBe('2027-03-02');
    expect(addMonthsToDateInput('2026-01-31', 1)).toBe('2026-03-03');
    expect(addMonthsToDateInput('not a date', 1)).toBe(undefined);
  });
});

describe('nextDueFromSchedule', () => {
  it('counts the interval from this service', () => {
    expect(nextDueFromSchedule(oil, { serviceDate: '2026-09-23', odometer: 32_000 })).toEqual({
      date: '2027-09-23',
      odometer: 42_000,
    });
  });

  it('gives what it can, and nothing without an interval', () => {
    expect(
      nextDueFromSchedule(
        { km: 9_000, months: null, source: 'default' },
        { serviceDate: '2026-09-23', odometer: 32_000 },
      ),
    ).toEqual({ date: undefined, odometer: 41_000 });
    expect(nextDueFromSchedule(oil, { serviceDate: '2026-09-23', odometer: Number.NaN })).toEqual({
      date: '2027-09-23',
      odometer: undefined,
    });
    expect(nextDueFromSchedule(undefined, { serviceDate: '2026-09-23', odometer: 32_000 })).toBe(
      null,
    );
  });
});

describe('scheduledNextDue', () => {
  const base = {
    interval: oil,
    category: 'engine_oil',
    serviceDate: '2026-09-23',
    odometer: 32_000,
    records: [],
    currentOdometer: 32_000,
    today: '2026-09-23',
  };

  it('is due by the schedule for the latest service', () => {
    expect(scheduledNextDue(base)).toEqual({
      kind: 'due',
      due: { date: '2027-09-23', odometer: 42_000 },
    });
  });

  it('leaves it to a later service of the same kind, but not a draft or another kind', () => {
    const later = {
      id: 'later',
      category: 'engine_oil',
      serviceDate: '2026-09-01T00:00:00.000Z',
      odometer: 33_000,
    };

    expect(scheduledNextDue({ ...base, records: [later] }).kind).toBe('superseded');
    expect(scheduledNextDue({ ...base, records: [{ ...later, status: 'draft' }] }).kind).toBe(
      'due',
    );
    expect(
      scheduledNextDue({ ...base, records: [{ ...later, category: 'periodic_service' }] }).kind,
    ).toBe('due');
    expect(scheduledNextDue({ ...base, records: [later], excludeRecordId: 'later' }).kind).toBe(
      'due',
    );
  });

  it('sets none for an old service whose next one is already due on every count', () => {
    expect(
      scheduledNextDue({
        ...base,
        serviceDate: '2024-01-10',
        odometer: 12_000,
        currentOdometer: 32_000,
      }).kind,
    ).toBe('passed');
  });

  it('has none for work the schedule does not cover', () => {
    expect(scheduledNextDue({ ...base, interval: undefined }).kind).toBe('unscheduled');
  });
});
