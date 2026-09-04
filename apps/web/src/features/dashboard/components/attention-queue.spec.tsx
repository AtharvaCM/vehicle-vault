import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { ReminderStatus } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

import { makeAttentionCounts, makeAttentionItem, makeSummary, makeVehicle } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { AttentionQueue } from './attention-queue';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const mutate = vi.fn();

vi.mock('@/features/reminders/hooks/use-complete-reminder', () => ({
  useCompleteReminder: () => ({ mutate, isPending: false, variables: undefined }),
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

describe('AttentionQueue', () => {
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
    expect(screen.getByText('Overdue', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('This week', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Brake pads')).toBeInTheDocument();
    expect(screen.getByText('3 days overdue')).toBeInTheDocument();
    expect(screen.getByText('PUC certificate', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Expires in 4 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Brake pads done' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Renew' })).toBeInTheDocument();
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

  it('shows the filter chip and clears the focus', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();

    renderWithProviders(
      <AttentionQueue
        focus="overdue"
        onSearchStateChange={onSearchStateChange}
        queue={[overdueReminder]}
        summary={makeSummary({
          attention: [overdueReminder],
          attentionTotal: 1,
          attentionCounts: makeAttentionCounts({ overdue: 1, total: 1 }),
        })}
      />,
    );

    expect(screen.getByText('Showing: Overdue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ focus: undefined });
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
    expect(
      screen.getByText('No reminders are due and no documents expire in the next 7 days.'),
    ).toBeInTheDocument();
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
    expect(within(screen.getByRole('region', { name: 'This week' })).getAllByTestId('attention-row')).toHaveLength(10);
  });
});
