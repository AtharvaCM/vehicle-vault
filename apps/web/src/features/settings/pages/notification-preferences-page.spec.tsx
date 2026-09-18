import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ALERT_KINDS,
  type NotificationPreference,
  type NotificationPreferences,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { ALERT_KIND_COPY } from '@/features/notifications/utils/alert-kind-copy';

const api = vi.hoisted(() => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));
const auth = vi.hoisted(() => ({ current: { user: { emailVerified: true } } }));
const push = vi.hoisted(() => ({
  current: { status: 'off', enable: vi.fn(), disable: vi.fn() },
}));

// The query options are rebuilt around the mocks: the real ones close over the
// module's own fetch function, which a spread of the original would keep.
vi.mock('@/features/notifications/api/notification-preferences', async () => {
  const { queryKeys } = await import('@/lib/query/query-keys');
  return {
    getNotificationPreferences: api.getNotificationPreferences,
    updateNotificationPreferences: api.updateNotificationPreferences,
    notificationPreferencesQueryOptions: () => ({
      queryKey: queryKeys.notifications.preferences(),
      queryFn: () => api.getNotificationPreferences(),
    }),
  };
});
vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('@/features/notifications/hooks/use-push-notifications', () => ({
  usePushNotifications: () => push.current,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { NotificationPreferencesPage } from './notification-preferences-page';

function every(delivery: { email: boolean; push: boolean }): NotificationPreferences {
  return { preferences: ALERT_KINDS.map((kind) => ({ kind, ...delivery })) };
}

/** What the API answers after applying `changes` to `base`. */
function applied(base: NotificationPreferences, changes: NotificationPreference[]) {
  const byKind = new Map(changes.map((change) => [change.kind, change]));
  return {
    preferences: base.preferences.map((preference) => byKind.get(preference.kind) ?? preference),
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationPreferencesPage />
    </QueryClientProvider>,
  );
}

const switchFor = (name: string) => screen.getByRole('switch', { name });

/** The body of the most recent save. */
const lastSaved = () => api.updateNotificationPreferences.mock.calls.at(-1)?.[0];

describe('NotificationPreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.current = { user: { emailVerified: true } };
    push.current = { status: 'off', enable: vi.fn(), disable: vi.fn() };
    api.getNotificationPreferences.mockResolvedValue(every({ email: true, push: true }));
    api.updateNotificationPreferences.mockImplementation(
      async ({ preferences }: { preferences: NotificationPreference[] }) =>
        applied(every({ email: true, push: true }), preferences),
    );
  });

  it('lists every kind of alert with its label, description and both switches', async () => {
    renderPage();

    await screen.findByText('Every alert');
    for (const kind of ALERT_KINDS) {
      const { label, description } = ALERT_KIND_COPY[kind];
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
      expect(switchFor(`${label} by email`)).toHaveAttribute('aria-checked', 'true');
      expect(switchFor(`${label} by push`)).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('saves one switch, moves it straight away and says when it is saved', async () => {
    let finish: (value: NotificationPreferences) => void = () => {};
    api.updateNotificationPreferences.mockImplementation(
      () => new Promise<NotificationPreferences>((resolve) => (finish = resolve)),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('switch', { name: 'Service overdue by email' }));

    await waitFor(() =>
      expect(lastSaved()).toEqual({
        preferences: [{ kind: 'maintenance-overdue', email: false, push: true }],
      }),
    );
    // Moved before the server has answered: the save is still pending here.
    expect(switchFor('Service overdue by email')).toHaveAttribute('aria-checked', 'false');
    expect(switchFor('Service overdue by push')).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('Saving…')).toBeInTheDocument();

    await act(async () => {
      finish(
        applied(every({ email: true, push: true }), [
          { kind: 'maintenance-overdue', email: false, push: true },
        ]),
      );
    });

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(switchFor('Service overdue by email')).toHaveAttribute('aria-checked', 'false');
  });

  it('puts the switch back and says why when a save fails', async () => {
    api.updateNotificationPreferences.mockRejectedValue(
      new ApiError('Request failed', 500, {
        success: false,
        error: { code: 'INTERNAL', message: 'Something broke on our side.' },
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('switch', { name: 'Tyre worn by push' }));

    expect(
      await screen.findByText('Something broke on our side. The switch has been put back.'),
    ).toBeInTheDocument();
    expect(switchFor('Tyre worn by push')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows every email switch off after an unsubscribe, and turns one back on', async () => {
    api.getNotificationPreferences.mockResolvedValue(every({ email: false, push: true }));
    renderPage();

    await screen.findByText('Every alert');
    expect(screen.getByRole('button', { name: 'Turn email on for every alert' })).toBeVisible();
    for (const kind of ALERT_KINDS) {
      expect(switchFor(`${ALERT_KIND_COPY[kind].label} by email`)).toHaveAttribute(
        'aria-checked',
        'false',
      );
    }

    fireEvent.click(switchFor('Reminder coming up by email'));

    await waitFor(() =>
      expect(lastSaved()).toEqual({
        preferences: [{ kind: 'reminder-due', email: true, push: true }],
      }),
    );
  });

  it('turns a channel off for every alert in one go', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn push off for every alert' }));

    await waitFor(() =>
      expect(lastSaved()).toEqual({
        preferences: ALERT_KINDS.map((kind) => ({ kind, email: true, push: false })),
      }),
    );
  });

  it('offers to turn a channel back on for everything once any kind is off', async () => {
    api.getNotificationPreferences.mockResolvedValue(
      applied(every({ email: true, push: true }), [
        { kind: 'tyre-aged', email: false, push: true },
      ]),
    );
    renderPage();

    // Not "off": most kinds still email, so the row offers the action instead.
    fireEvent.click(await screen.findByRole('button', { name: 'Turn email on for every alert' }));

    await waitFor(() =>
      expect(lastSaved()).toEqual({
        preferences: ALERT_KINDS.map((kind) => ({ kind, email: true, push: true })),
      }),
    );
    expect(screen.getByRole('button', { name: 'Turn push off for every alert' })).toBeVisible();
  });

  it('carries the push switch for this device that used to sit in the bell', async () => {
    push.current.enable.mockResolvedValue(true);
    renderPage();

    fireEvent.click(
      await screen.findByRole('switch', { name: 'Push notifications on this device' }),
    );

    await waitFor(() => expect(push.current.enable).toHaveBeenCalled());
  });

  it('explains a push switch this device cannot use', async () => {
    push.current = { status: 'denied', enable: vi.fn(), disable: vi.fn() };
    renderPage();

    expect(
      await screen.findByText('Notifications are blocked for this site in your browser settings.'),
    ).toBeInTheDocument();
    expect(switchFor('Push notifications on this device')).toBeDisabled();
  });

  it('warns an unverified account that email waits for verification', async () => {
    auth.current = { user: { emailVerified: false } };
    renderPage();

    expect(
      await screen.findByText('Email alerts start once your address is verified.'),
    ).toBeInTheDocument();
  });

  it('offers a retry when the preferences cannot be loaded', async () => {
    api.getNotificationPreferences.mockRejectedValue(new Error('offline'));
    renderPage();

    expect(await screen.findByText('Unable to load preferences')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
