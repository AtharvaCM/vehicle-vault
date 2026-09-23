import { render, screen } from '@testing-library/react';
import { ReminderStatus, ReminderType, VehicleRole, type Reminder } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
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
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
vi.mock('../hooks/use-vehicle-reminders', () => ({
  useVehicleReminders: () => remindersQuery.current,
}));
vi.mock('../hooks/use-bulk-complete-reminders', () => ({ useBulkCompleteReminders: mutation }));
vi.mock('../hooks/use-bulk-delete-reminders', () => ({ useBulkDeleteReminders: mutation }));
// Fetches its own suggestions; covered by its own spec, viewer case included.
vi.mock('../components/service-schedule-panel', () => ({ ServiceSchedulePanel: () => null }));

import { VehicleRemindersPage } from './vehicle-reminders-page';

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
  vehicleQuery.current = {
    data: { id: 'vehicle-1', make: 'Bajaj', model: 'Pulsar NS 200', currentUserRole: role },
  };
  remindersQuery.current = { data: reminders, isPending: false, isError: false };

  return render(
    <VehicleRemindersPage onSearchStateChange={vi.fn()} searchState={{}} vehicleId="vehicle-1" />,
  );
}

describe('VehicleRemindersPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'lets an %s add, select and bulk act',
    (role) => {
      renderAs(role, [reminder]);

      expect(screen.getByRole('link', { name: 'Add reminder' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select all visible' })).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: /select reminder insurance renewal/i }),
      ).toBeInTheDocument();
    },
  );

  it('shows a viewer the reminders without any way to change them', () => {
    renderAs(VehicleRole.Viewer, [reminder]);

    // Reading stays open to them.
    expect(screen.getByText('Insurance renewal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to vehicle' })).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: 'Add reminder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select all visible' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
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
