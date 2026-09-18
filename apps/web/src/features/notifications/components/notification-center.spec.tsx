import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
const openNotification = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const notificationsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('../hooks/use-notifications', () => ({
  useNotifications: () => notificationsQuery.current,
  useOpenNotification: () => openNotification,
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../hooks/use-push-notifications', () => ({
  usePushNotifications: () => ({ status: 'unsupported', enable: vi.fn(), disable: vi.fn() }),
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
});
