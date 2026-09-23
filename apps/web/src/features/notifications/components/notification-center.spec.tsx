import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
const openNotification = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const notificationsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const summaryQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('@/features/dashboard/hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => summaryQuery.current,
}));
vi.mock('../hooks/use-notifications', () => ({
  useNotifications: () => notificationsQuery.current,
  useOpenNotification: () => openNotification,
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { NotificationCenter } from './notification-center';

const notification = (overrides: Record<string, unknown>) => ({
  id: 'notif-1',
  title: 'Reminder Due Soon: Insurance renewal',
  message: '"Insurance renewal" is due in 3 days on 21 Sept 2026.',
  type: 'warning',
  isRead: false,
  link: '/vehicles/vehicle-1?tab=reminders',
  createdAt: '2026-09-18T06:00:00.000Z',
  ...overrides,
});

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openNotification.mutateAsync.mockResolvedValue(undefined);
    summaryQuery.current = { data: undefined };
  });

  const attentionCounts = (overrides: Record<string, number>) => ({
    overdue: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    documentsExpiring30d: 0,
    vehiclesNeedingAttention: 0,
    urgentVehicles: 0,
    total: 0,
    ...overrides,
  });

  it('never says all caught up while the dashboard has something due', async () => {
    notificationsQuery.current = {
      data: { notifications: [], unreadCount: 0 },
      isLoading: false,
    };
    summaryQuery.current = {
      data: { attentionCounts: attentionCounts({ overdue: 1, thisWeek: 4 }) },
    };
    render(<NotificationCenter />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(
      await screen.findByRole('link', { name: '5 things need your attention on the dashboard' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('No new alerts')).toBeInTheDocument();
    expect(screen.queryByText('All caught up!')).not.toBeInTheDocument();
  });

  it('is all caught up when only things coming up later remain', async () => {
    notificationsQuery.current = {
      data: { notifications: [], unreadCount: 0 },
      isLoading: false,
    };
    summaryQuery.current = { data: { attentionCounts: attentionCounts({ thisMonth: 2 }) } };
    render(<NotificationCenter />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText('All caught up!')).toBeInTheDocument();
  });

  const openBellAndClick = async (title: string) => {
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    fireEvent.click(await screen.findByText(title));
  };

  it('opens a notification through the API before following its link', async () => {
    notificationsQuery.current = {
      data: { notifications: [notification({})], unreadCount: 1 },
      isLoading: false,
    };
    render(<NotificationCenter />);

    await openBellAndClick('Reminder Due Soon: Insurance renewal');

    await waitFor(() => expect(openNotification.mutateAsync).toHaveBeenCalledWith('notif-1'));
    expect(navigate).toHaveBeenCalledWith({ href: '/vehicles/vehicle-1?tab=reminders' });
  });

  it('still reports an open for a notification already read, so revisits count', async () => {
    notificationsQuery.current = {
      data: { notifications: [notification({ isRead: true })], unreadCount: 0 },
      isLoading: false,
    };
    render(<NotificationCenter />);

    await openBellAndClick('Reminder Due Soon: Insurance renewal');

    await waitFor(() => expect(openNotification.mutateAsync).toHaveBeenCalledWith('notif-1'));
  });

  it('sends people to the preferences page for push and email choices', async () => {
    notificationsQuery.current = {
      data: { notifications: [], unreadCount: 0 },
      isLoading: false,
    };
    render(<NotificationCenter />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByRole('link', { name: 'Notification preferences' })).toHaveAttribute(
      'href',
      '/settings/preferences',
    );
    // The per-device push switch moved there with the rest.
    expect(screen.queryByRole('button', { name: /push/i })).not.toBeInTheDocument();
  });
});
