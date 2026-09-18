import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  current: { isAuthenticated: false, refreshUser: vi.fn() },
}));
const verifyEmail = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('../api/verify-email', () => ({ verifyEmail }));
vi.mock('@/lib/toast', () => ({ appToast: toast }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
  useSearch: () => ({ token: 'link-token' }),
}));

import { VerifyEmailPage } from './verify-email-page';

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyEmail.mockResolvedValue({ verified: true });
    auth.current = { isAuthenticated: false, refreshUser: vi.fn().mockResolvedValue(null) };
  });

  it('keeps a signed-in user signed in and takes them back into the app', async () => {
    auth.current = { isAuthenticated: true, refreshUser: vi.fn().mockResolvedValue({}) };

    render(<VerifyEmailPage />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/dashboard', replace: true }));
    expect(verifyEmail).toHaveBeenCalledWith({ token: 'link-token' });
    // The verified account has to be in the session before the app renders it.
    expect(auth.current.refreshUser).toHaveBeenCalled();
    expect(auth.current.refreshUser.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]!,
    );
    expect(screen.queryByText(/continue to login/i)).not.toBeInTheDocument();
  });

  it('sends a signed-out user to sign in, as before', async () => {
    render(<VerifyEmailPage />);

    expect(await screen.findAllByText('Email Verified!')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: /continue to login/i })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(auth.current.refreshUser).not.toHaveBeenCalled();
  });

  it('points a signed-in user with a spent link back to the app, not to login', async () => {
    auth.current = { isAuthenticated: true, refreshUser: vi.fn() };
    verifyEmail.mockRejectedValue(new Error('This verification link is invalid or has expired.'));

    render(<VerifyEmailPage />);

    expect(await screen.findAllByText('Verification Failed')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: /back to your garage/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.queryByRole('link', { name: /back to login/i })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('spends the token once even when StrictMode runs the effect twice', async () => {
    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
    );

    expect(await screen.findAllByText('Email Verified!')).not.toHaveLength(0);
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });
});
