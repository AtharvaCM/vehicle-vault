import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutate = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-snooze-reminder', () => ({
  useSnoozeReminder: () => ({ mutate, isPending: false }),
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { appToast } from '@/lib/toast';

import { describeSnoozeTarget, SnoozeReminderDialog } from './snooze-reminder-dialog';

const reminder = {
  id: 'reminder-1',
  title: 'Engine oil change',
  dueDate: '2026-09-20T00:00:00.000Z',
  dueOdometer: 45000,
};

describe('SnoozeReminderDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T09:00:00.000Z'));
    mutate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers a week, a month or a date, previewing where the reminder lands', async () => {
    const user = userEvent.setup();
    render(
      <SnoozeReminderDialog currentOdometer={45200} onOpenChange={vi.fn()} reminder={reminder} />,
    );

    expect(screen.getByRole('dialog', { name: 'Snooze Engine oil change' })).toBeInTheDocument();
    // Late: a week from today, and 500 km on from the odometer, which is past the target.
    expect(screen.getByTestId('snooze-preview')).toHaveTextContent(
      'Due again 2 Oct 2026 or at 45,700 km, whichever comes first',
    );

    await user.click(screen.getByRole('radio', { name: '1 month' }));
    expect(screen.getByTestId('snooze-preview')).toHaveTextContent(
      'Due again 25 Oct 2026 or at 47,700 km, whichever comes first',
    );

    await user.click(screen.getByRole('radio', { name: 'Pick a date' }));
    expect(screen.getByTestId('snooze-preview')).toHaveTextContent(
      'Pick the day it should come back.',
    );
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeDisabled();
  });

  it('saves the chosen period and tells the caller', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSnoozed = vi.fn();
    render(
      <SnoozeReminderDialog
        onOpenChange={onOpenChange}
        onSnoozed={onSnoozed}
        reminder={{ ...reminder, dueOdometer: null }}
      />,
    );

    await user.click(screen.getByRole('radio', { name: '1 month' }));
    await user.click(screen.getByRole('button', { name: 'Snooze' }));

    expect(mutate).toHaveBeenCalledWith(
      { reminderId: 'reminder-1', choice: { period: 'month' } },
      expect.any(Object),
    );
    const options = mutate.mock.calls[0]?.[1] as { onSuccess: (value: unknown) => void };
    options.onSuccess({ id: 'reminder-1' });

    expect(appToast.success).toHaveBeenCalledWith({
      title: 'Snoozed',
      description: 'Engine oil change · Due again 25 Oct 2026',
    });
    expect(onSnoozed).toHaveBeenCalledWith({ id: 'reminder-1' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays closed without a reminder', () => {
    render(<SnoozeReminderDialog onOpenChange={vi.fn()} reminder={null} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('describeSnoozeTarget', () => {
  it('names the date, the kilometres, or both', () => {
    const date = new Date('2026-10-02T00:00:00.000Z');

    expect(describeSnoozeTarget({ dueDate: date, dueOdometer: null })).toBe('Due again 2 Oct 2026');
    expect(describeSnoozeTarget({ dueDate: null, dueOdometer: 12500 })).toBe(
      'Due again at 12,500 km',
    );
    expect(describeSnoozeTarget({ dueDate: date, dueOdometer: 12500 })).toBe(
      'Due again 2 Oct 2026 or at 12,500 km, whichever comes first',
    );
  });
});
