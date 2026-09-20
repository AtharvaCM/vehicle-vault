import { render, screen } from '@testing-library/react';
import { ReminderStatus, ReminderType, VehicleRole, type Reminder } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const reminderQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
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

vi.mock('../hooks/use-reminder', () => ({ useReminder: () => reminderQuery.current }));
vi.mock('../hooks/use-complete-reminder', () => ({ useCompleteReminder: mutation }));
vi.mock('../hooks/use-delete-reminder', () => ({ useDeleteReminder: mutation }));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));

import { ReminderDetailPage } from './reminder-detail-page';

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

function renderAs(role: VehicleRole) {
  reminderQuery.current = { data: reminder, isPending: false, isError: false };
  vehicleQuery.current = {
    data: {
      id: 'vehicle-1',
      make: 'Bajaj',
      model: 'Pulsar NS 200',
      registrationNumber: 'MH12AB1234',
      currentUserRole: role,
    },
  };

  return render(<ReminderDetailPage reminderId="reminder-1" />);
}

describe('ReminderDetailPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'lets an %s edit, complete and delete',
    (role) => {
      renderAs(role);

      expect(screen.getByRole('link', { name: 'Edit Reminder' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Reminder' })).toBeInTheDocument();
    },
  );

  it('shows a viewer the reminder without any way to change it', () => {
    renderAs(VehicleRole.Viewer);

    // Reading stays open to them, vehicle label included.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Insurance renewal' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bajaj Pulsar NS 200 • MH12AB1234')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Vehicle Reminders' })).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: 'Edit Reminder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Complete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Reminder' })).not.toBeInTheDocument();
  });
});
