import { fireEvent, render, screen } from '@testing-library/react';
import { ReminderStatus, ReminderType, VehicleRole, type Reminder } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const accessState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const remindersQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
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
}));

vi.mock('@/features/vehicles/context/vehicle-access', () => ({
  useVehicleAccess: () => accessState.current,
}));
vi.mock('../hooks/use-vehicle-reminders', () => ({
  useVehicleReminders: () => remindersQuery.current,
}));
vi.mock('../hooks/use-bulk-complete-reminders', () => ({ useBulkCompleteReminders: mutation }));
vi.mock('../hooks/use-bulk-delete-reminders', () => ({ useBulkDeleteReminders: mutation }));
vi.mock('../hooks/use-complete-reminder', () => ({ useCompleteReminder: mutation }));
vi.mock('../hooks/use-snooze-reminder', () => ({ useSnoozeReminder: mutation }));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => ({ data: { odometer: 12000 } }),
}));

import { VehicleReminderList } from './vehicle-reminder-list';

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

function renderAs(role: VehicleRole, reminders: Reminder[]) {
  accessState.current = { role, canEdit: role !== VehicleRole.Viewer };
  remindersQuery.current = { data: reminders, isPending: false, isError: false };

  return render(<VehicleReminderList vehicleId="vehicle-1" />);
}

describe('VehicleReminderList roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('lets an %s select and bulk act', (role) => {
    renderAs(role, [reminder]);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByRole('button', { name: 'Select all visible' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /select reminder insurance renewal/i }),
    ).toBeInTheDocument();
  });

  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'offers an %s Done and Snooze on an open reminder',
    (role) => {
      renderAs(role, [
        reminder,
        { ...reminder, id: 'reminder-2', title: 'Old PUC', status: ReminderStatus.Completed },
      ]);

      expect(
        screen.getByRole('button', { name: 'Mark Insurance renewal done' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Snooze Insurance renewal' })).toBeInTheDocument();
      // A completed reminder has nothing left to do.
      expect(screen.queryByRole('button', { name: 'Mark Old PUC done' })).not.toBeInTheDocument();
    },
  );

  it('shows a viewer the reminders without any way to change them', () => {
    renderAs(VehicleRole.Viewer, [reminder]);

    // Reading stays open to them.
    expect(screen.getByText('Insurance renewal')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select all visible' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /done|snooze/i })).not.toBeInTheDocument();
  });

  it('gives a viewer an empty list without an add prompt', () => {
    renderAs(VehicleRole.Viewer, []);

    expect(screen.getByText('No reminders yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add the first reminder' })).not.toBeInTheDocument();
  });

  it('keeps the empty-state add prompt for an editor', () => {
    renderAs(VehicleRole.Editor, []);

    expect(screen.getByRole('link', { name: 'Add the first reminder' })).toBeInTheDocument();
  });
});

describe('VehicleReminderList scales to the list', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...reminder,
      id: `reminder-${index}`,
      title: `Reminder ${index}`,
    }));

  it('draws one reminder with no filters, no selection bar and no empty groups', () => {
    renderAs(VehicleRole.Owner, [reminder]);

    expect(screen.getByText('1 reminder')).toBeInTheDocument();
    expect(screen.getByText('Upcoming reminders for this vehicle.')).toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    expect(screen.queryByText(/no overdue reminders/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search by title/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Select reminders to take action')).not.toBeInTheDocument();
  });

  it('leaves five reminders without search and filters', () => {
    renderAs(VehicleRole.Owner, many(5));
    expect(screen.queryByPlaceholderText(/search by title/i)).not.toBeInTheDocument();
  });

  it('gives six reminders their search and filters', () => {
    renderAs(VehicleRole.Owner, many(6));
    expect(screen.getByPlaceholderText(/search by title/i)).toBeInTheDocument();
  });

  it('drops the selection when Select is done', () => {
    renderAs(VehicleRole.Owner, [reminder]);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /select reminder insurance renewal/i }));
    expect(screen.getByText('1 reminder selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByText('Select reminders to take action')).toBeInTheDocument();
  });
});
