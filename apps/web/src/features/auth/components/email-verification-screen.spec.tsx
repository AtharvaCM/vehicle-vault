import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'late@example.com' }, logout: vi.fn() }),
}));
vi.mock('../hooks/use-resend-verification', () => ({
  useResendVerification: () => ({ resend: vi.fn(), isResending: false, hasSent: false }),
}));

import { EmailVerificationScreen } from './email-verification-screen';

describe('EmailVerificationScreen', () => {
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
});
