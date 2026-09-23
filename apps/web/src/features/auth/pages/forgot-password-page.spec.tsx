import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const requestPasswordReset = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../api/request-password-reset', () => ({ requestPasswordReset }));
vi.mock('@/lib/toast', () => ({ appToast: toast }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { ForgotPasswordPage } from './forgot-password-page';

async function requestFor(email: string) {
  const user = userEvent.setup();
  render(<ForgotPasswordPage />);
  await user.type(screen.getByLabelText(/email address/i), email);
  await user.click(screen.getByRole('button', { name: /send|reset/i }));
  return user;
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPasswordReset.mockResolvedValue({ accepted: true });
  });

  it('replaces the form with a panel that stays, naming the address and the link’s life', async () => {
    await requestFor('asha@example.test');

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText(/if an account exists for asha@example.test/i)).toBeInTheDocument();
    expect(screen.getByText(/works for 30 minutes/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    // Sending again waits out a cooldown rather than feeding the mail rate limit.
    expect(screen.getByRole('button', { name: /send again in \d+s/i })).toBeDisabled();
  });

  it('goes back to the form for a different address', async () => {
    const user = await requestFor('asha@example.test');

    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(screen.getByLabelText(/email address/i)).toHaveValue('');
  });

  it('says reset by email is unavailable when the server cannot send mail', async () => {
    requestPasswordReset.mockRejectedValue(
      new ApiError('Password reset is unavailable right now.', 503),
    );

    await requestFor('asha@example.test');

    expect(
      await screen.findByText('Password reset by email isn’t available yet'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });
});
