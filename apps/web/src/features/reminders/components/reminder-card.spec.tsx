import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import type { Reminder } from '../types/reminder';
import { ReminderCard } from './reminder-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const dateOnly: Reminder = {
  id: 'reminder-1',
  vehicleId: 'vehicle-1',
  title: 'Renew the parking permit',
  type: ReminderType.Custom,
  dueDate: '2026-11-06T00:00:00.000Z',
  status: ReminderStatus.Upcoming,
  createdAt: '2026-09-22T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
};

describe('ReminderCard', () => {
  it('shows the target odometer in a figures strip', () => {
    render(<ReminderCard reminder={{ ...dateOnly, dueOdometer: 24_800 }} />);

    const figures = screen.getByTestId('reminder-figures');
    expect(figures).toHaveTextContent('Target ODO');
    expect(figures).toHaveTextContent('24,800 km');
  });

  // A date-only reminder has no figure to show. It used to get the strip anyway:
  // an empty band under its text, holding only the chevron.
  it('leaves the figures strip out when there is no target odometer', () => {
    render(<ReminderCard reminder={dateOnly} />);

    expect(screen.queryByTestId('reminder-figures')).not.toBeInTheDocument();
    expect(screen.getByText('Due 06 Nov 2026')).toBeInTheDocument();
  });
});
