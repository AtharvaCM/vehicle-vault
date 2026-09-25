import { ReminderStatus } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { describeDue } from './describe-due';

const now = new Date('2026-09-23T06:30:00.000Z'); // Noon in India.
const open = { status: ReminderStatus.Upcoming, completedAt: undefined };

describe('describeDue', () => {
  it('says how late a dated reminder is, and when it was due', () => {
    expect(describeDue({ ...open, dueDate: '2026-09-20T00:00:00.000Z' }, { now })).toEqual({
      status: 'late',
      text: 'Overdue by 3 days — was due 20 Sep 2026',
    });
  });

  it('says today, and days to go with the date', () => {
    expect(describeDue({ ...open, dueDate: '2026-09-23T00:00:00.000Z' }, { now }).text).toBe(
      'Due today',
    );
    expect(describeDue({ ...open, dueDate: '2026-10-05T00:00:00.000Z' }, { now })).toEqual({
      status: 'info',
      text: 'Due in 12 days — 5 Oct 2026',
    });
    expect(describeDue({ ...open, dueDate: '2026-09-24T00:00:00.000Z' }, { now }).text).toBe(
      'Due in 1 day — 24 Sep 2026',
    );
  });

  it('counts kilometres to go, and estimates when from the usage projection', () => {
    expect(
      describeDue(
        {
          ...open,
          dueOdometer: 27_500,
          usageProjection: {
            projectedDueDate: '2026-10-15T00:00:00.000Z',
            kmPerDay: 40,
            confidence: 'medium',
            sampleCount: 6,
            sampleDays: 60,
          },
        },
        { odometer: 26_300, now },
      ),
    ).toEqual({
      status: 'info',
      text: 'Due at 27,500 km — 1,200 km to go (≈ mid-Oct at your usage)',
    });
  });

  it('says how far past it a distance reminder is', () => {
    expect(describeDue({ ...open, dueOdometer: 27_500 }, { odometer: 27_800, now })).toEqual({
      status: 'late',
      text: 'Due at 27,500 km — 300 km past it',
    });
  });

  it('names the reading alone when the vehicle reading is unknown', () => {
    expect(describeDue({ ...open, dueOdometer: 27_500 }, { now }).text).toBe('Due at 27,500 km');
  });

  it('says when a completed reminder was done', () => {
    expect(
      describeDue(
        { status: ReminderStatus.Completed, completedAt: '2026-09-01T10:00:00.000Z' },
        { now },
      ).text,
    ).toBe('Done on 1 Sep 2026');
  });
});
