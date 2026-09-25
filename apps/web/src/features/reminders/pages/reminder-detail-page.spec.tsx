import { fireEvent, render, screen } from '@testing-library/react';
import {
  MaintenanceCategory,
  ReminderStatus,
  ReminderType,
  VehicleRole,
  type Reminder,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const reminderQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to: string;
  }) => (
    <a data-search={search ? JSON.stringify(search) : undefined} href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../hooks/use-reminder', () => ({ useReminder: () => reminderQuery.current }));
vi.mock('../hooks/use-complete-reminder', () => ({ useCompleteReminder: mutation }));
vi.mock('../hooks/use-snooze-reminder', () => ({ useSnoozeReminder: mutation }));
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

      expect(screen.getByRole('link', { name: 'Edit reminder' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Mark Insurance renewal done' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Snooze Insurance renewal' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete reminder' })).toBeInTheDocument();
    },
  );

  it('shows a viewer the reminder without any way to change it', () => {
    renderAs(VehicleRole.Viewer);

    // Reading stays open to them, vehicle label included.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Insurance renewal' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bajaj Pulsar NS 200 • MH12AB1234')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Reminders' })).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: 'Edit reminder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /done|snooze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete reminder' })).not.toBeInTheDocument();
  });
});

describe('ReminderDetailPage repeat rule', () => {
  it('says how the reminder repeats, and shows the notes as written', () => {
    reminderQuery.current = {
      data: {
        ...reminder,
        notes: 'Recommended every 10 000 km or 12 months, whichever comes first.',
        catalogSlug: 'engine_oil_change',
        repeatEveryKm: 10000,
        repeatEveryMonths: 12,
      },
      isPending: false,
      isError: false,
    };
    vehicleQuery.current = { data: { id: 'vehicle-1', currentUserRole: VehicleRole.Owner } };

    render(<ReminderDetailPage reminderId="reminder-1" />);

    expect(
      screen.getByText('Repeats every 10,000 km or 12 months, whichever comes first'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Recommended every 10 000 km or 12 months, whichever comes first.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\[catalog:/)).not.toBeInTheDocument();
  });

  it('says a one-off reminder does not repeat', () => {
    reminderQuery.current = { data: reminder, isPending: false, isError: false };
    vehicleQuery.current = { data: { id: 'vehicle-1', currentUserRole: VehicleRole.Owner } };

    render(<ReminderDetailPage reminderId="reminder-1" />);

    expect(screen.getByText('Doesn’t repeat')).toBeInTheDocument();
  });
});

describe('ReminderDetailPage Done and what happens next', () => {
  const oilChange: Reminder = {
    ...reminder,
    id: '3f6b1a52-8f4e-4c1f-9d55-3f2c7b9e1a20',
    title: 'Engine oil change',
    type: ReminderType.Service,
    catalogSlug: 'engine_oil_change',
    repeatEveryKm: 10000,
    repeatEveryMonths: 12,
    logCategory: MaintenanceCategory.EngineOil,
  };

  function renderReminder(data: Reminder) {
    reminderQuery.current = { data, isPending: false, isError: false };
    vehicleQuery.current = {
      data: { id: 'vehicle-1', odometer: 12000, currentUserRole: VehicleRole.Owner },
    };
    render(<ReminderDetailPage reminderId={data.id} />);
  }

  it('says what completing a service counts the next one from', () => {
    renderReminder(oilChange);

    expect(screen.getByTestId('reminder-next-step')).toHaveTextContent(
      'Repeats every 10,000 km or 12 months; the next one will be counted from the service you log.',
    );
  });

  it('asks a service reminder’s Done whether to log the service, naming the reminder', () => {
    renderReminder(oilChange);

    fireEvent.click(screen.getByRole('button', { name: 'Mark Engine oil change done' }));

    const log = screen.getByRole('link', { name: 'Log the service now' });
    expect(log).toHaveAttribute('href', '/vehicles/$vehicleId/maintenance/new');
    expect(JSON.parse(log.getAttribute('data-search') ?? '{}')).toEqual({
      category: 'engine_oil',
      reminderId: oilChange.id,
    });
    expect(screen.getByRole('button', { name: 'Mark done without logging' })).toBeInTheDocument();
  });

  it('sends a renewal that follows a paper to Renew, with no snooze of its own', () => {
    renderReminder({
      ...reminder,
      renewsDocument: { kind: 'insurance', id: '9b2f4c1e-2d3a-4b5c-8d6e-7f8091a2b3c4' },
    });

    expect(screen.getByRole('link', { name: 'Renew' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'papers' }),
    );
    expect(screen.queryByRole('button', { name: /done|snooze/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('reminder-next-step')).not.toBeInTheDocument();
  });
});

function renderErrored(error: unknown) {
  const refetch = vi.fn();
  reminderQuery.current = { isPending: false, isError: true, error, refetch };
  vehicleQuery.current = {};

  render(<ReminderDetailPage reminderId="reminder-1" />);

  return { refetch };
}

describe('ReminderDetailPage errors', () => {
  it('tells a malformed or unknown reminder id apart from a real failure', () => {
    renderErrored(new ApiError('Reminder not found', 404));

    expect(screen.getByText("This reminder isn't in your garage.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upcoming' })).toHaveAttribute('href', '/upcoming');
  });

  it('tells a viewer whose access was removed why, not just that it failed', () => {
    renderErrored(new ApiError('Forbidden', 403));

    expect(
      screen.getByText('You no longer have access — the owner may have removed you.'),
    ).toBeInTheDocument();
  });

  it('offers a working Try again that refetches on a network/5xx failure', () => {
    const { refetch } = renderErrored(new ApiError('Internal error', 500));

    expect(screen.getByText("We couldn't load this reminder.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
