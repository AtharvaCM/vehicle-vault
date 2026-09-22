import { render, screen } from '@testing-library/react';
import { ReminderStatus, ReminderType, type Reminder } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const remindersQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const vehiclesQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: Record<string, string>; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => vehiclesQuery.current,
}));
vi.mock('../hooks/use-reminders', () => ({
  useReminders: () => remindersQuery.current,
}));
vi.mock('../hooks/use-bulk-complete-reminders', () => ({ useBulkCompleteReminders: mutation }));
vi.mock('../hooks/use-bulk-delete-reminders', () => ({ useBulkDeleteReminders: mutation }));

import { RemindersPage } from './reminders-page';

const reminder: Reminder = {
  id: 'reminder-1',
  vehicleId: 'vehicle-1',
  title: 'Insurance renewal',
  type: ReminderType.Insurance,
  dueDate: '2026-10-10T00:00:00.000Z',
  status: ReminderStatus.Upcoming,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('RemindersPage', () => {
  // The vehicle labels used to be rebuilt on every render, which re-ran the
  // effect that prunes the selection on every render too, until React gave up
  // with "Maximum update depth exceeded" and the page fell to the error screen.
  it('renders the reminders across the garage without looping', () => {
    remindersQuery.current = { data: [reminder], isPending: false, isError: false };
    vehiclesQuery.current = {
      data: [
        {
          id: 'vehicle-1',
          make: 'Bajaj',
          model: 'Pulsar NS 200',
          nickname: 'Daily',
          registrationNumber: 'MH12AB1234',
        },
      ],
    };

    render(<RemindersPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.getByText('Insurance renewal')).toBeInTheDocument();
    expect(screen.getByText('Daily • MH12AB1234')).toBeInTheDocument();
  });
});
