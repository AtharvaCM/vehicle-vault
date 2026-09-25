import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { ReminderType, type UpcomingGroupCounts, type UpcomingItem } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import type { UpcomingPage as UpcomingApiPage } from '../api/get-upcoming';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
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

const upcomingState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const vehiclesState = vi.hoisted(() => ({
  current: { data: [] as unknown[], isPending: false } as Record<string, unknown>,
}));

vi.mock('../hooks/use-upcoming', () => ({
  useUpcoming: () => upcomingState.current,
}));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => vehiclesState.current,
}));

const completeMutate = vi.fn();
const snoozeReminderMutate = vi.fn();
const snoozeDocumentMutate = vi.fn();

vi.mock('@/features/reminders/hooks/use-complete-reminder', () => ({
  useCompleteReminder: () => ({ mutate: completeMutate, isPending: false, variables: undefined }),
}));
vi.mock('@/features/reminders/hooks/use-snooze-reminder', () => ({
  useSnoozeReminder: () => ({
    mutate: snoozeReminderMutate,
    isPending: false,
    variables: undefined,
  }),
}));
vi.mock('@/features/dashboard/hooks/use-snooze-document', () => ({
  useSnoozeDocument: () => ({
    mutate: snoozeDocumentMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import { UpcomingPage } from './upcoming-page';

function makeItem(overrides: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    id: 'reminder-1',
    kind: 'reminder',
    urgency: 'this_week',
    vehicleId: 'vehicle-1',
    vehicleName: 'Daily driver',
    registrationNumber: 'MH12AB1234',
    currentUserRole: 'owner',
    title: 'Engine oil change',
    reminderType: ReminderType.Service,
    dueDate: '2026-09-28T00:00:00.000Z',
    daysUntilDue: 3,
    ...overrides,
  };
}

function makeCounts(overrides: Partial<UpcomingGroupCounts> = {}): UpcomingGroupCounts {
  return { late: 0, this_week: 0, this_month: 0, later: 0, ...overrides };
}

function makeApiPage(overrides: Partial<UpcomingApiPage> = {}): UpcomingApiPage {
  return {
    items: [],
    counts: makeCounts(),
    page: 1,
    laterTotal: 0,
    ...overrides,
  };
}

type UpcomingQueryStub = {
  isPending: boolean;
  isError: boolean;
  data: { pages: UpcomingApiPage[] } | undefined;
  dataUpdatedAt: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
};

function makeUpcomingQuery(overrides: Partial<UpcomingQueryStub> = {}): UpcomingQueryStub {
  return {
    isPending: false,
    isError: false,
    data: { pages: [makeApiPage()] },
    dataUpdatedAt: 1,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

const noop = vi.fn();

function renderPage(
  overrides: Partial<Parameters<typeof UpcomingPage>[0]> = {},
): ReturnType<typeof render> {
  return render(<UpcomingPage onSearchStateChange={noop} searchState={{}} {...overrides} />);
}

describe('UpcomingPage', () => {
  it('shows a loading state while the query is pending', () => {
    upcomingState.current = makeUpcomingQuery({
      isPending: true,
      data: undefined,
    });

    renderPage();

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText("Checking what's due across your garage.")).toBeInTheDocument();
  });

  it('shows an error state and retries on demand', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    upcomingState.current = makeUpcomingQuery({
      isError: true,
      data: undefined,
      refetch,
    });

    renderPage();

    expect(screen.getByText('Unable to load Upcoming')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders all four groups from one page, each with its own rows and counts', () => {
    const lateItem = makeItem({ id: 'r-late', urgency: 'overdue', title: 'Brake pads' });
    const weekItem = makeItem({ id: 'r-week', urgency: 'this_week', title: 'Engine oil change' });
    const monthItem = makeItem({ id: 'r-month', urgency: 'this_month', title: 'Cabin filter' });
    const laterItem = makeItem({ id: 'r-later', urgency: 'later', title: 'Timing belt' });

    upcomingState.current = makeUpcomingQuery({
      data: {
        pages: [
          makeApiPage({
            items: [lateItem, weekItem, monthItem, laterItem],
            counts: makeCounts({ late: 1, this_week: 1, this_month: 1, later: 1 }),
            laterTotal: 1,
          }),
        ],
      },
    });

    renderPage();

    expect(
      within(screen.getByTestId('upcoming-group-late')).getByText('Brake pads'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('upcoming-group-this_week')).getByText('Engine oil change'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('upcoming-group-this_month')).getByText('Cabin filter'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('upcoming-group-later')).getByText('Timing belt'),
    ).toBeInTheDocument();

    expect(screen.getAllByTestId('upcoming-row')).toHaveLength(4);
  });

  it('shows the empty text for a group whose count is 0 while others are not', () => {
    const weekItemA = makeItem({ id: 'r-week-a', urgency: 'this_week', title: 'Week thing A' });
    const weekItemB = makeItem({ id: 'r-week-b', urgency: 'this_week', title: 'Week thing B' });

    upcomingState.current = makeUpcomingQuery({
      data: {
        pages: [
          makeApiPage({
            items: [weekItemA, weekItemB],
            counts: makeCounts({ this_week: 2 }),
          }),
        ],
      },
    });

    renderPage();

    expect(
      within(screen.getByTestId('upcoming-group-late')).getByText('Nothing late.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('upcoming-group-this_month')).getByText(
        'Nothing else in the next 30 days.',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('upcoming-group-later')).getByText('Nothing further ahead.'),
    ).toBeInTheDocument();
  });

  it('shows "All clear" when late, this week and this month are all 0, but still shows Later', () => {
    const laterA = makeItem({ id: 'r-later-a', urgency: 'later', title: 'Later thing A' });
    const laterB = makeItem({ id: 'r-later-b', urgency: 'later', title: 'Later thing B' });

    upcomingState.current = makeUpcomingQuery({
      data: {
        pages: [
          makeApiPage({
            items: [laterA, laterB],
            counts: makeCounts({ later: 2 }),
            laterTotal: 2,
          }),
        ],
      },
    });

    renderPage();

    expect(screen.getByTestId('upcoming-all-clear')).toBeInTheDocument();
    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-group-late')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-group-this_week')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-group-this_month')).not.toBeInTheDocument();

    const laterGroup = screen.getByTestId('upcoming-group-later');
    expect(within(laterGroup).getByText('Later thing A')).toBeInTheDocument();
    expect(within(laterGroup).getByText('Later thing B')).toBeInTheDocument();
  });

  it('shows "Nothing here" when a filter empties the timeline, and clears it on demand', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();

    upcomingState.current = makeUpcomingQuery({
      data: { pages: [makeApiPage()] },
    });

    renderPage({
      searchState: { kind: 'papers' },
      onSearchStateChange,
    });

    expect(screen.getByText('Nothing here')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show everything' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ vehicle: undefined, kind: undefined });
  });

  it('reports a kind toggle to the caller as a search-state change', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();

    upcomingState.current = makeUpcomingQuery({
      data: { pages: [makeApiPage()] },
    });

    renderPage({ onSearchStateChange });

    await user.click(screen.getByRole('radio', { name: 'Papers' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ kind: 'papers' });
  });

  it('shows Show more when there is a next page, and fetches it on click', async () => {
    const user = userEvent.setup();
    const fetchNextPage = vi.fn();
    const laterItem = makeItem({ id: 'r-later', urgency: 'later', title: 'Later thing' });

    upcomingState.current = makeUpcomingQuery({
      data: {
        pages: [
          makeApiPage({
            items: [laterItem],
            counts: makeCounts({ later: 3 }),
            laterTotal: 3,
          }),
        ],
      },
      hasNextPage: true,
      fetchNextPage,
    });

    renderPage();

    const showMore = screen.getByRole('button', { name: 'Show more (2 left)' });
    await user.click(showMore);

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('collects later rows across every page, but takes the near groups from page 1 only', () => {
    const weekA = makeItem({ id: 'r-week-a', urgency: 'this_week', title: 'Week thing A' });
    const weekB = makeItem({ id: 'r-week-b', urgency: 'this_week', title: 'Week thing B' });
    const laterA = makeItem({ id: 'r-later-a', urgency: 'later', title: 'Later thing A' });
    const laterB = makeItem({ id: 'r-later-b', urgency: 'later', title: 'Later thing B' });

    upcomingState.current = makeUpcomingQuery({
      data: {
        pages: [
          makeApiPage({
            items: [weekA, laterA],
            counts: makeCounts({ this_week: 1, later: 2 }),
            laterTotal: 2,
          }),
          makeApiPage({
            // A repeated near-group row plus a second later row, as the real
            // API would send on page 2: only the later row should count.
            items: [weekB, laterB],
            page: 2,
            counts: makeCounts({ this_week: 1, later: 2 }),
            laterTotal: 2,
          }),
        ],
      },
    });

    renderPage();

    const weekGroup = screen.getByTestId('upcoming-group-this_week');
    expect(within(weekGroup).getByText('Week thing A')).toBeInTheDocument();
    expect(within(weekGroup).queryByText('Week thing B')).not.toBeInTheDocument();
    expect(screen.queryByText('Week thing B')).not.toBeInTheDocument();

    const laterGroup = screen.getByTestId('upcoming-group-later');
    expect(within(laterGroup).getByText('Later thing A')).toBeInTheDocument();
    expect(within(laterGroup).getByText('Later thing B')).toBeInTheDocument();
  });

  it('shows a status line under the title summarising late, this-week and this-month counts', () => {
    upcomingState.current = makeUpcomingQuery({
      data: {
        pages: [
          makeApiPage({
            counts: makeCounts({ late: 1, this_week: 2 }),
          }),
        ],
      },
    });

    renderPage();

    expect(screen.getByText('1 late · 2 this week')).toBeInTheDocument();
  });
});
