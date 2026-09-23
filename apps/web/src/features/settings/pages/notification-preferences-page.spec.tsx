import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ALERT_KINDS,
  type NotificationChannelAvailability,
  type NotificationChannelsAvailability,
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

const AVAILABLE: NotificationChannelAvailability = { available: true, reason: null };

/** Both channels available unless a reason overrides one of them. */
function channels(
  overrides: Partial<NotificationChannelsAvailability> = {},
): NotificationChannelsAvailability {
  return { email: AVAILABLE, push: AVAILABLE, ...overrides };
}

function every(
  delivery: { email: boolean; push: boolean },
  channelsAvailability: NotificationChannelsAvailability = channels(),
): NotificationPreferences {
  return {
    preferences: ALERT_KINDS.map((kind) => ({ kind, ...delivery })),
    channels: channelsAvailability,
  };
}

/** What the API answers after applying `changes` to `base`. */
function applied(base: NotificationPreferences, changes: NotificationPreference[]) {
  const byKind = new Map(changes.map((change) => [change.kind, change]));
  return {
    preferences: base.preferences.map((preference) => byKind.get(preference.kind) ?? preference),
    channels: base.channels,
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
    api.getNotificationPreferences.mockResolvedValue(
      every(
        { email: true, push: true },
        channels({ email: { available: false, reason: 'email_unverified' } }),
      ),
    );
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

  describe('channel availability', () => {
    it('keeps both columns interactive when both channels are available', async () => {
      renderPage();

      await screen.findByText('Every alert');
      expect(switchFor('Service overdue by email')).not.toBeDisabled();
      expect(switchFor('Service overdue by push')).not.toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Turn email off for every alert' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Turn push off for every alert' }),
      ).toBeInTheDocument();
    });

    it('disables the email column, explains why, and never writes when mail is not configured', async () => {
      api.getNotificationPreferences.mockResolvedValue(
        every(
          { email: true, push: true },
          channels({ email: { available: false, reason: 'not_configured' } }),
        ),
      );
      renderPage();

      expect(
        await screen.findByText(
          "Email alerts aren't available yet — every alert still appears in the bell",
        ),
      ).toBeInTheDocument();

      for (const kind of ALERT_KINDS) {
        const emailSwitch = switchFor(`${ALERT_KIND_COPY[kind].label} by email`);
        expect(emailSwitch).toBeDisabled();
        expect(emailSwitch).toHaveAttribute('aria-checked', 'false');
      }
      expect(switchFor('Service overdue by push')).not.toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Turn email off for every alert' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Turn push off for every alert' }),
      ).toBeInTheDocument();

      fireEvent.click(switchFor('Service overdue by email'));
      expect(api.updateNotificationPreferences).not.toHaveBeenCalled();
    });

    it('disables the push column and explains why when push is not configured on the server', async () => {
      api.getNotificationPreferences.mockResolvedValue(
        every(
          { email: true, push: true },
          channels({ push: { available: false, reason: 'not_configured' } }),
        ),
      );
      renderPage();

      expect(
        await screen.findByText('Push notifications aren’t set up on the server yet.'),
      ).toBeInTheDocument();

      const pushSwitch = switchFor('Service overdue by push');
      expect(pushSwitch).toBeDisabled();
      expect(pushSwitch).toHaveAttribute('aria-checked', 'false');
      expect(switchFor('Service overdue by email')).not.toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Turn push off for every alert' }),
      ).not.toBeInTheDocument();

      fireEvent.click(pushSwitch);
      expect(api.updateNotificationPreferences).not.toHaveBeenCalled();
    });

    it('disables the push column and explains why there is no device to push to', async () => {
      api.getNotificationPreferences.mockResolvedValue(
        every(
          { email: true, push: true },
          channels({ push: { available: false, reason: 'no_device' } }),
        ),
      );
      renderPage();

      expect(
        await screen.findByText('Turn on push for this device to choose which alerts are pushed'),
      ).toBeInTheDocument();
      expect(switchFor('Service overdue by push')).toBeDisabled();

      fireEvent.click(switchFor('Service overdue by push'));
      expect(api.updateNotificationPreferences).not.toHaveBeenCalled();
    });

    it('disables both columns, explains both, and keeps every stored preference when neither channel is available', async () => {
      // The stored value has email and push both on for every kind; since
      // neither channel can deliver, every switch must still read off.
      api.getNotificationPreferences.mockResolvedValue(
        every(
          { email: true, push: true },
          channels({
            email: { available: false, reason: 'not_configured' },
            push: { available: false, reason: 'no_device' },
          }),
        ),
      );
      renderPage();

      expect(
        await screen.findByText(
          "Email alerts aren't available yet — every alert still appears in the bell",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Turn on push for this device to choose which alerts are pushed'),
      ).toBeInTheDocument();

      for (const kind of ALERT_KINDS) {
        const { label } = ALERT_KIND_COPY[kind];
        const emailSwitch = switchFor(`${label} by email`);
        const pushSwitch = switchFor(`${label} by push`);
        expect(emailSwitch).toBeDisabled();
        expect(emailSwitch).toHaveAttribute('aria-checked', 'false');
        expect(pushSwitch).toBeDisabled();
        expect(pushSwitch).toHaveAttribute('aria-checked', 'false');
      }
      expect(screen.queryByRole('button', { name: /for every alert$/ })).not.toBeInTheDocument();

      fireEvent.click(switchFor('Service overdue by email'));
      fireEvent.click(switchFor('Service overdue by push'));
      expect(api.updateNotificationPreferences).not.toHaveBeenCalled();
    });
  });
});
