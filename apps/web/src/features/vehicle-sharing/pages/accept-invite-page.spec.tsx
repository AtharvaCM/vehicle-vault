import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VehicleInvitePreview } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

type FakeAuth = {
  isAuthenticated: boolean;
  user?: { email: string };
  logout: ReturnType<typeof vi.fn>;
};

const auth = vi.hoisted(() => ({ current: {} as FakeAuth }));
const preview = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const accept = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, error: null }));
const decline = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, error: null }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../hooks/use-sharing', () => ({
  useInvitePreview: () => preview.current,
  useAcceptInvite: () => accept,
  useDeclineInvite: () => decline,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: { next?: string } }) => (
    <a href={search?.next ? `${to}?next=${encodeURIComponent(search.next)}` : to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

import { AcceptInvitePage } from './accept-invite-page';

const TOKEN = 'f'.repeat(64);

const pending: VehicleInvitePreview = {
  status: 'pending',
  vehicleLabel: 'Family SUV (MH12AB1234)',
  inviterName: 'Asha',
  role: 'editor' as VehicleInvitePreview['role'],
  emailMasked: 'r***@gmail.com',
  expiresAt: '2026-09-30T00:00:00.000Z',
};

function showing(data: VehicleInvitePreview) {
  preview.current = { isPending: false, isError: false, data, refetch: vi.fn() };
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.current = { isAuthenticated: false, logout: vi.fn() };
    showing(pending);
  });

  it('previews the invite signed out, with sign-in and registration that come back here', () => {
    render(<AcceptInvitePage token={TOKEN} />);

    expect(screen.getAllByText('Family SUV (MH12AB1234)').length).toBeGreaterThan(0);
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getAllByText(/r\*\*\*@gmail\.com/).length).toBeGreaterThan(0);
    expect(screen.getByText(/log services, fuel and documents/i)).toBeInTheDocument();

    const next = encodeURIComponent(`/vehicle-invites/${TOKEN}`);
    expect(screen.getByRole('link', { name: 'Sign in to accept' })).toHaveAttribute(
      'href',
      `/login?next=${next}`,
    );
    expect(screen.getByRole('link', { name: 'Create account to accept' })).toHaveAttribute(
      'href',
      `/register?next=${next}`,
    );
    // Nothing is accepted just by opening the link.
    expect(accept.mutate).not.toHaveBeenCalled();
  });

  it('asks the invited account to accept or decline, and does neither on its own', async () => {
    auth.current = { isAuthenticated: true, user: { email: 'rahul@gmail.com' }, logout: vi.fn() };
    showing({ ...pending, addressedToYou: true });
    const user = userEvent.setup();

    render(<AcceptInvitePage token={TOKEN} />);

    expect(accept.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));
    expect(accept.mutate).toHaveBeenCalledWith(TOKEN, expect.any(Object));

    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(decline.mutate).toHaveBeenCalledWith(TOKEN, expect.any(Object));
  });

  it('takes an accepted invite to the vehicle', async () => {
    auth.current = { isAuthenticated: true, user: { email: 'rahul@gmail.com' }, logout: vi.fn() };
    showing({ ...pending, addressedToYou: true });
    accept.mutate.mockImplementation(
      (_token: string, options: { onSuccess: (result: { vehicleId: string }) => void }) =>
        options.onSuccess({ vehicleId: 'vehicle-1' }),
    );
    const user = userEvent.setup();

    render(<AcceptInvitePage token={TOKEN} />);
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(navigate).toHaveBeenCalledWith({
      to: '/vehicles/$vehicleId',
      params: { vehicleId: 'vehicle-1' },
    });
  });

  it('explains a wrong account and offers to switch, keeping the invite', async () => {
    const logout = vi.fn();
    auth.current = { isAuthenticated: true, user: { email: 'demo@example.test' }, logout };
    showing({ ...pending, addressedToYou: false });
    const user = userEvent.setup();

    render(<AcceptInvitePage token={TOKEN} />);

    expect(
      screen.getAllByText(
        /this invite is for r\*\*\*@gmail\.com\. you’re signed in as demo@example\.test/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign out and switch account' }));

    expect(logout).toHaveBeenCalled();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { next: `/vehicle-invites/${TOKEN}` },
      }),
    );
  });

  it.each([
    ['declined', 'This invite was declined'],
    ['revoked', 'This invite was cancelled'],
    ['expired', 'This invite has expired'],
    ['accepted', 'This invite has already been accepted'],
  ] as const)('says a %s invite has ended', (status, title) => {
    showing({ ...pending, status });

    render(<AcceptInvitePage token={TOKEN} />);

    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Sign in to accept' })).not.toBeInTheDocument();
  });

  it('says an unknown link is not found', () => {
    preview.current = {
      isPending: false,
      isError: true,
      error: new ApiError('Invitation not found.', 404),
      refetch: vi.fn(),
    };

    render(<AcceptInvitePage token={TOKEN} />);

    expect(screen.getAllByText('We couldn’t find this invite').length).toBeGreaterThan(0);
  });
});
