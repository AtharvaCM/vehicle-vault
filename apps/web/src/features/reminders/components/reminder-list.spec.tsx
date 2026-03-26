import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { ReminderList } from './reminder-list';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const reminder = {
  id: 'reminder-1',
  vehicleId: 'vehicle-1',
  title: 'Insurance renewal',
  type: ReminderType.Insurance,
  dueDate: '2026-04-10T00:00:00.000Z',
  status: ReminderStatus.Upcoming,
  notes: 'Renew policy',
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
};

describe('ReminderList', () => {
  it('renders selection checkboxes and reports selection changes', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(
      <ReminderList
        emptyMessage="No reminders"
        onSelectionChange={onSelectionChange}
        reminders={[reminder]}
        selectedReminderIds={[]}
        title="Upcoming"
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /select reminder insurance renewal/i }));

    expect(onSelectionChange).toHaveBeenCalledWith('reminder-1', true);
  });

  it('reflects controlled selection state', () => {
    render(
      <ReminderList
        emptyMessage="No reminders"
        onSelectionChange={vi.fn()}
        reminders={[reminder]}
        selectedReminderIds={['reminder-1']}
        title="Upcoming"
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: /select reminder insurance renewal/i }),
    ).toBeChecked();
  });
});
