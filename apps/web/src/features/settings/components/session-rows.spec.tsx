import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthSession } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmHost } from '@/components/shared/confirm';

const api = vi.hoisted(() => ({
  getSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));

vi.mock('../api/sessions', () => ({
  sessionsQueryOptions: () => ({ queryKey: ['account', 'sessions'], queryFn: api.getSessions }),
  revokeSession: api.revokeSession,
  revokeOtherSessions: api.revokeOtherSessions,
}));
vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));

import { describeSession, SessionRows } from './session-rows';

const now = new Date('2026-09-25T12:00:00.000Z');

function session(overrides: Partial<AuthSession>): AuthSession {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    device: 'Chrome on macOS',
    location: 'Pune, Maharashtra, India',
    createdAt: '2026-09-01T00:00:00.000Z',
    lastActiveAt: now.toISOString(),
    current: false,
    ...overrides,
  };
}

const THIS = session({ id: '11111111-1111-4111-8111-111111111111', current: true });
const PHONE = session({
  id: '22222222-2222-4222-8222-222222222222',
  device: 'Safari on iPhone',
  location: null,
  lastActiveAt: '2026-09-25T09:00:00.000Z',
});
const OLD = session({ id: '33333333-3333-4333-8333-333333333333', device: null, location: null });

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SessionRows />
      <ConfirmHost />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // The API lists by last activity; this device is not always first.
  api.getSessions.mockResolvedValue([PHONE, THIS, OLD]);
  api.revokeSession.mockResolvedValue(undefined);
  api.revokeOtherSessions.mockResolvedValue({ revoked: 2 });
});

describe('describeSession', () => {
  it('says where and when, in words', () => {
    expect(describeSession(THIS, now)).toBe('Pune, Maharashtra, India · Active now');
    expect(describeSession(PHONE, now)).toMatch(/^Active 3 hours ago$/);
  });
});

describe('SessionRows', () => {
  it('lists this device first and marked, with no Sign out on it', async () => {
    show();

    const rows = await screen.findAllByTestId('session-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Chrome on macOS');
    expect(rows[0]).toHaveTextContent('This device');
    expect(within(rows[0]!).queryByRole('button')).not.toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Safari on iPhone');
    expect(rows[2]).toHaveTextContent('A device signed in earlier');
    expect(screen.getByText('2 other devices signed in')).toBeInTheDocument();
  });

  it('signs one device out once confirmed', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: 'Sign out Safari on iPhone' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(api.revokeSession).toHaveBeenCalledWith(PHONE.id);
  });

  it('signs out every other device once confirmed', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: /Sign out other devices/ }));
    expect(await screen.findByText('Sign out the other 2 devices?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(api.revokeOtherSessions).toHaveBeenCalled();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: /Sign out other devices/ }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(api.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it('offers no "other devices" row when this is the only one', async () => {
    api.getSessions.mockResolvedValue([THIS]);
    show();

    expect(await screen.findByTestId('session-row')).toHaveTextContent('This device');
    expect(
      screen.queryByRole('button', { name: /Sign out other devices/ }),
    ).not.toBeInTheDocument();
  });
});
