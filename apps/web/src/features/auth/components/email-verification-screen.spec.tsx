import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  current: {
    user: { id: 'user-1', email: 'late@example.com' },
    logout: vi.fn(),
    verificationEmailFailed: false,
    clearVerificationEmailFailure: vi.fn(),
  },
}));
vi.mock('../hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('../hooks/use-resend-verification', () => ({
  useResendVerification: () => ({ resend: vi.fn(), isResending: false, hasSent: false }),
}));

import { EmailVerificationScreen } from './email-verification-screen';

describe('EmailVerificationScreen', () => {
  afterEach(() => {
    auth.current = { ...auth.current, verificationEmailFailed: false };
  });

  it('says where the link went, that nothing is lost, and that reminders wait on it', () => {
    render(<EmailVerificationScreen />);

    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByText('late@example.com')).toBeInTheDocument();
    expect(
      screen.getByText(/your reminders are emailed to you once it is verified/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('asks for a resend when registration could not send the link', () => {
    auth.current = { ...auth.current, verificationEmailFailed: true };
    render(<EmailVerificationScreen />);

    expect(screen.getByText(/we couldn't send a verification link to/i)).toBeInTheDocument();
    expect(screen.queryByText(/we've sent a verification link/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled();
  });
});
