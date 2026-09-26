import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { FuelType, MaintenanceCategory, ReminderStatus } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

import { makeAttentionCounts, makeAttentionItem, makeSummary, makeVehicle } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { AttentionQueue } from './attention-queue';

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
    to?: string;
  }) => (
    <a data-search={search ? JSON.stringify(search) : undefined} href={to} {...props}>
      {children}
    </a>
  ),
}));

const mutate = vi.fn();
const snoozeMutate = vi.fn();

vi.mock('@/features/reminders/hooks/use-complete-reminder', () => ({
  useCompleteReminder: () => ({ mutate, isPending: false, variables: undefined }),
}));

vi.mock('../hooks/use-snooze-document', () => ({
  useSnoozeDocument: () => ({ mutate: snoozeMutate, isPending: false, variables: undefined }),
}));

vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

type MutateOptions = {
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

function lastMutateOptions(): MutateOptions {
  return mutate.mock.calls.at(-1)?.[1] as MutateOptions;
}

function lastSnoozeMutateOptions(): MutateOptions {
  return snoozeMutate.mock.calls.at(-1)?.[1] as MutateOptions;
}

const twoVehicles = [
  makeVehicle({ id: 'vehicle-1', displayName: 'Daily driver' }),
  makeVehicle({ id: 'vehicle-2', displayName: 'Weekend bike', registrationNumber: 'MH12ZZ0001' }),
];

const overdueReminder = makeAttentionItem({
  id: 'reminder-overdue',
  urgency: 'overdue',
  reminderStatus: ReminderStatus.Overdue,
  title: 'Brake pads',
  daysUntilDue: -3,
  dueDate: '2026-03-30T00:00:00.000Z',
});
const expiringDoc = makeAttentionItem({
  id: 'doc-puc',
  kind: 'document',
  documentKind: 'puc',
  title: 'PUC certificate',
  provider: 'Bharat Petroleum',
  urgency: 'this_week',
  daysUntilDue: 4,
  vehicleId: 'vehicle-2',
  vehicleName: 'Weekend bike',
  registrationNumber: 'MH12ZZ0001',
});
const overdueDoc = makeAttentionItem({
  id: 'doc-insurance-overdue',
  kind: 'document',
  documentKind: 'insurance',
  title: 'Insurance policy',
  urgency: 'overdue',
  daysUntilDue: -2,
  dueDate: '2026-03-18T00:00:00.000Z',
});

describe('AttentionQueue', () => {
  it('shows what the bell knows, each row leading to the tab that fixes it', () => {
    const wornTyre = makeAttentionItem({
      id: 'tyre:fl',
      kind: 'tyre',
      urgency: 'overdue',
      title: 'Tyre not roadworthy',
      detail: 'Front left · 1.4 mm tread',
      dueDate: null,
      daysUntilDue: null,
      reminderType: undefined,
      reminderStatus: undefined,
    });
    const dashcam = makeAttentionItem({
      id: 'accessory:acc-1',
      kind: 'accessory',
      urgency: 'this_week',
      title: '70mai Dashcam warranty',
      dueDate: '2026-04-06T00:00:00.000Z',
      daysUntilDue: 4,
      reminderType: undefined,
      reminderStatus: undefined,
    });

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[wornTyre, dashcam]}
        summary={makeSummary({
          attention: [wornTyre, dashcam],
          attentionTotal: 2,
          attentionCounts: makeAttentionCounts({ overdue: 1, thisWeek: 1, total: 2 }),
        })}
      />,
    );

    expect(screen.getByText('Tyre not roadworthy')).toBeInTheDocument();
    expect(screen.getByText('Tyre')).toBeInTheDocument();
    // Undated: what the verdict rests on, where a dated row says when it is due.
    expect(screen.getByText('Front left · 1.4 mm tread')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View tyres' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'more', section: 'tyres' }),
    );

    expect(screen.getByText('Accessory')).toBeInTheDocument();
    expect(screen.getByText('4 days left')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View accessory' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'history', view: 'accessory' }),
    );

    // Neither is ticked off or snoozed from here: the fix happens on the tab.
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /snooze/i })).not.toBeInTheDocument();
  });

  it('renders group labels and rows with their actions', () => {
    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueReminder, expiringDoc]}
        summary={makeSummary({
          vehicles: twoVehicles,
          attention: [overdueReminder, expiringDoc],
          attentionTotal: 2,
          attentionCounts: makeAttentionCounts({ overdue: 1, thisWeek: 1, total: 2 }),
        })}
      />,
    );

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText('Late')).toHaveAttribute('data-status', 'late');
    expect(screen.getByText('This week')).toHaveAttribute('data-status', 'soon');
    expect(screen.getByText('Brake pads')).toBeInTheDocument();
    expect(screen.getByText('3 days late')).toBeInTheDocument();
    expect(screen.getByText('PUC certificate', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('4 days left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Brake pads done' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Renew' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Snooze PUC certificate' })).toBeInTheDocument();

    // More than one vehicle in the garage: each row names its vehicle with an S plate.
    expect(screen.getByText('MH 12 ZZ 0001')).toBeInTheDocument();
    expect(screen.getByText('Weekend bike')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="number-plate"][data-size="sm"]'),
    ).toBeInTheDocument();
  });

  it('draws an electric vehicle’s plate green (#355)', () => {
    const evReminder = makeAttentionItem({
      id: 'ev-reminder',
      title: 'Brake fluid',
      vehicleId: 'vehicle-2',
      vehicleName: 'Weekend bike',
      registrationNumber: 'MH12ZZ0001',
      vehicleFuelType: FuelType.Electric,
    });
    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueReminder, evReminder]}
        summary={makeSummary({
          vehicles: twoVehicles,
          attention: [overdueReminder, evReminder],
          attentionTotal: 2,
          attentionCounts: makeAttentionCounts({ overdue: 2, total: 2 }),
        })}
      />,
    );

    const variants = Array.from(document.querySelectorAll('[data-slot="number-plate"]')).map(
      (plate) => plate.getAttribute('data-variant'),
    );
    expect(variants).toContain('electric');
    expect(variants).toContain('private');
  });

  it('hides Snooze once a document is actually overdue', () => {
    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueDoc]}
        summary={makeSummary({
          attention: [overdueDoc],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    expect(screen.getByText('Insurance policy', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Renew' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /snooze/i })).not.toBeInTheDocument();
  });

  it('hides Done for viewers', () => {
    const viewerReminder = makeAttentionItem({ currentUserRole: 'viewer', title: 'Viewer task' });

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[viewerReminder]}
        summary={makeSummary({
          attention: [viewerReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ thisWeek: 1, total: 1 }),
        })}
      />,
    );

    expect(screen.getByText('Viewer task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();
  });

  it('completes a reminder with its id when Done is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueReminder]}
        summary={makeSummary({
          attention: [overdueReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Mark Brake pads done' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('reminder-overdue', expect.any(Object));
  });

  it('asks a service reminder’s Done whether to log the service first', async () => {
    const user = userEvent.setup();
    const oilChange = makeAttentionItem({
      id: 'reminder-oil',
      title: 'Engine oil change',
      logCategory: MaintenanceCategory.EngineOil,
    });

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[oilChange]}
        summary={makeSummary({
          attention: [oilChange],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ thisWeek: 1, total: 1 }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Mark Engine oil change done' }));

    expect(mutate).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Done with Engine oil change?' });
    const log = within(dialog).getByRole('link', { name: 'Log the service now' });
    expect(log).toHaveAttribute('href', '/vehicles/$vehicleId/maintenance/new');
    expect(log).toHaveAttribute(
      'data-search',
      JSON.stringify({ category: 'engine_oil', reminderId: 'reminder-oil' }),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Mark done without logging' }));
    expect(mutate).toHaveBeenCalledWith('reminder-oil', expect.any(Object));
  });

  it('opens the shared Snooze from a reminder row', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueReminder]}
        summary={makeSummary({
          attention: [overdueReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Snooze Brake pads' }));

    const dialog = await screen.findByRole('dialog', { name: 'Snooze Brake pads' });
    expect(within(dialog).getByRole('radio', { name: '1 week' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: '1 month' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Pick a date' })).toBeInTheDocument();
  });

  it('keeps the row disabled after success and announces the completion', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueReminder]}
        summary={makeSummary({
          attention: [overdueReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    const done = screen.getByRole('button', { name: 'Mark Brake pads done' });
    await user.click(done);

    // In flight: disabled immediately, before the request settles.
    expect(done).toBeDisabled();

    act(() => {
      lastMutateOptions().onSuccess();
      lastMutateOptions().onSettled();
    });

    // Settled but not yet refetched: stays disabled until the summary drops the row.
    expect(done).toBeDisabled();
    expect(appToast.success).toHaveBeenCalledWith({
      title: 'Reminder completed',
      description: 'Brake pads · Daily driver',
    });
    expect(screen.getByText('Brake pads · Daily driver marked done.')).toBeInTheDocument();
  });

  it('re-enables the row and reports the error when completion fails', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[overdueReminder]}
        summary={makeSummary({
          attention: [overdueReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    const done = screen.getByRole('button', { name: 'Mark Brake pads done' });
    await user.click(done);

    act(() => {
      lastMutateOptions().onError(new Error('boom'));
      lastMutateOptions().onSettled();
    });

    expect(done).toBeEnabled();
    expect(appToast.error).toHaveBeenCalledWith({
      title: 'Unable to complete reminder',
      description: 'boom',
    });
  });

  it('snoozes a document with its kind and id when Snooze is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[expiringDoc]}
        summary={makeSummary({
          attention: [expiringDoc],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ thisWeek: 1, total: 1 }),
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Snooze PUC certificate' }));

    expect(snoozeMutate).toHaveBeenCalledTimes(1);
    expect(snoozeMutate).toHaveBeenCalledWith(
      { documentKind: 'puc', documentId: 'doc-puc' },
      expect.any(Object),
    );
  });

  it('keeps the row disabled after a snooze succeeds and announces it', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[expiringDoc]}
        summary={makeSummary({
          attention: [expiringDoc],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ thisWeek: 1, total: 1 }),
        })}
      />,
    );

    const snooze = screen.getByRole('button', { name: 'Snooze PUC certificate' });
    await user.click(snooze);

    expect(snooze).toBeDisabled();

    act(() => {
      lastSnoozeMutateOptions().onSuccess();
      lastSnoozeMutateOptions().onSettled();
    });

    expect(snooze).toBeDisabled();
    expect(appToast.success).toHaveBeenCalledWith({
      title: 'Snoozed',
      description: 'PUC certificate · Weekend bike',
    });
    expect(screen.getByText('PUC certificate · Weekend bike snoozed.')).toBeInTheDocument();
  });

  it('re-enables the row and reports the error when snoozing fails', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[expiringDoc]}
        summary={makeSummary({
          attention: [expiringDoc],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ thisWeek: 1, total: 1 }),
        })}
      />,
    );

    const snooze = screen.getByRole('button', { name: 'Snooze PUC certificate' });
    await user.click(snooze);

    act(() => {
      lastSnoozeMutateOptions().onError(new Error('boom'));
      lastSnoozeMutateOptions().onSettled();
    });

    expect(snooze).toBeEnabled();
    expect(appToast.error).toHaveBeenCalledWith({
      title: 'Unable to snooze',
      description: 'boom',
    });
  });

  it('shows the focused empty state with a clear action', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();

    renderWithProviders(
      <AttentionQueue
        focus="documents"
        onSearchStateChange={onSearchStateChange}
        queue={[]}
        summary={makeSummary({
          attention: [overdueReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    expect(screen.getByText('Nothing expiring')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ focus: undefined });
  });

  it('renders the calm state when tracked items are simply not due', () => {
    renderWithProviders(
      <AttentionQueue onSearchStateChange={vi.fn()} queue={[]} summary={makeSummary()} />,
    );

    expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();
    expect(screen.getByText('Nothing is overdue or due in the next 7 days.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing is being tracked yet')).not.toBeInTheDocument();
  });

  it('renders the onboarding empty state when nothing is tracked at all', () => {
    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={[]}
        summary={makeSummary({
          vehicles: [
            makeVehicle({
              documents: {
                insurance: { state: 'missing', endDate: null },
                puc: { state: 'missing', endDate: null },
              },
            }),
          ],
        })}
      />,
    );

    const empty = screen.getByText('Nothing is being tracked yet').closest('div');

    expect(empty).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Add documents' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add reminder' })).toBeInTheDocument();
  });

  it('caps the initial list at eight rows and expands on demand', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 10 }, (_, index) =>
      makeAttentionItem({ id: `r-${index}`, title: `Task ${index}`, urgency: 'this_week' }),
    );

    renderWithProviders(
      <AttentionQueue
        onSearchStateChange={vi.fn()}
        queue={many}
        summary={makeSummary({
          attention: many,
          attentionTotal: 10,
          attentionCounts: makeAttentionCounts({ thisWeek: 10, total: 10 }),
        })}
      />,
    );

    expect(screen.getAllByTestId('attention-row')).toHaveLength(8);

    await user.click(screen.getByRole('button', { name: 'Show all 10' }));

    expect(screen.getAllByTestId('attention-row')).toHaveLength(10);
    expect(
      within(screen.getByRole('region', { name: 'This week' })).getAllByTestId('attention-row'),
    ).toHaveLength(10);
  });
});
