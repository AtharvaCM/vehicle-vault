import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type AnchorHTMLAttributes } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeAuth = {
  isAuthenticated: boolean;
  refreshUser: ReturnType<typeof vi.fn>;
  user?: { email: string; emailVerified: boolean };
};

const auth = vi.hoisted(() => ({
  current: { isAuthenticated: false, refreshUser: vi.fn() } as FakeAuth,
}));
const search = vi.hoisted(() => ({ current: { token: 'link-token' } as { token?: string } }));
const verifyEmail = vi.hoisted(() => vi.fn());
const resendVerification = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('../api/verify-email', () => ({ verifyEmail }));
vi.mock('../api/resend-verification', () => ({ resendVerification }));
vi.mock('@/lib/toast', () => ({ appToast: toast }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
  useSearch: () => search.current,
}));

import { ApiError } from '@/lib/api/api-error';

import { VerifyEmailPage } from './verify-email-page';

const unverified = { email: 'asha@example.test', emailVerified: false };
const spentLink = () => new ApiError('Invalid or expired verification token.', 401);

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyEmail.mockResolvedValue({ verified: true });
    resendVerification.mockResolvedValue({ accepted: true, delivered: true });
    search.current = { token: 'link-token' };
    auth.current = { isAuthenticated: false, refreshUser: vi.fn().mockResolvedValue(null) };
  });

  it('keeps a signed-in user signed in and takes them back into the app', async () => {
    auth.current = {
      isAuthenticated: true,
      refreshUser: vi.fn().mockResolvedValue({}),
      user: unverified,
    };

    render(<VerifyEmailPage />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/home', replace: true }));
    expect(verifyEmail).toHaveBeenCalledWith({ token: 'link-token' });
    // The verified account has to be in the session before the app renders it.
    expect(auth.current.refreshUser).toHaveBeenCalled();
    expect(auth.current.refreshUser.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]!,
    );
    expect(screen.queryByText(/continue to sign in/i)).not.toBeInTheDocument();
  });

  it('sends a signed-out user to sign in, as before', async () => {
    render(<VerifyEmailPage />);

    expect(await screen.findAllByText('Email verified')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(auth.current.refreshUser).not.toHaveBeenCalled();
  });

  it('shows a signed-in user a spent link as a failure, with a new link on offer', async () => {
    auth.current = { isAuthenticated: true, refreshUser: vi.fn(), user: unverified };
    verifyEmail.mockRejectedValue(spentLink());
    const user = userEvent.setup();

    render(<VerifyEmailPage />);

    expect(
      await screen.findAllByText('This link has expired or was already used'),
    ).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: /continue to your garage/i })).toHaveAttribute(
      'href',
      '/home',
    );
    expect(navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(resendVerification).toHaveBeenCalledWith({ email: 'asha@example.test' });
    expect(await screen.findByRole('button', { name: 'New link sent' })).toBeDisabled();
  });

  it('says so when no new link can go out because email is off', async () => {
    auth.current = { isAuthenticated: true, refreshUser: vi.fn(), user: unverified };
    verifyEmail.mockRejectedValue(spentLink());
    resendVerification.mockResolvedValue({ accepted: true, delivered: false });
    const user = userEvent.setup();

    render(<VerifyEmailPage />);

    await user.click(await screen.findByRole('button', { name: 'Send a new link' }));

    expect(await screen.findByRole('button', { name: 'Email isn’t available yet' })).toBeDisabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows a signed-out visitor a spent link as a failure, pointing to sign in', async () => {
    verifyEmail.mockRejectedValue(spentLink());

    render(<VerifyEmailPage />);

    expect(
      await screen.findAllByText('This link has expired or was already used'),
    ).not.toHaveLength(0);
    expect(screen.getAllByText(/if you already verified, just sign in/i)).not.toHaveLength(0);
    for (const link of screen.getAllByRole('link', { name: /^sign in$/i })) {
      expect(link).toHaveAttribute('href', '/login');
    }
    expect(screen.queryByRole('button', { name: 'Send a new link' })).not.toBeInTheDocument();
  });

  it('treats an already-verified account as done without spending the link', async () => {
    auth.current = {
      isAuthenticated: true,
      refreshUser: vi.fn(),
      user: { email: 'asha@example.test', emailVerified: true },
    };

    render(<VerifyEmailPage />);

    expect(await screen.findAllByText('Already verified')).not.toHaveLength(0);
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /continue to your garage/i })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('says a link without a token is incomplete', async () => {
    search.current = {};

    render(<VerifyEmailPage />);

    expect(await screen.findAllByText('This verification link is incomplete')).not.toHaveLength(0);
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('offers a retry when the failure was not the link', async () => {
    verifyEmail.mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup();

    render(<VerifyEmailPage />);

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findAllByText('Email verified')).not.toHaveLength(0);
    expect(verifyEmail).toHaveBeenCalledTimes(2);
  });

  it('spends the token once even when StrictMode runs the effect twice', async () => {
    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
    );

    expect(await screen.findAllByText('Email verified')).not.toHaveLength(0);
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });
});
