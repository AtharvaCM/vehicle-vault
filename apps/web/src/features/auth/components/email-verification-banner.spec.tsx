import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const auth = vi.hoisted(() => ({
  current: { user: { id: 'user-1', email: 'new@example.com' } as { id: string; email: string } },
}));
const resendVerification = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('../api/resend-verification', () => ({ resendVerification }));
vi.mock('@/lib/toast', () => ({ appToast: toast }));

import { RESEND_COOLDOWN_MS } from '../hooks/use-resend-verification';
import { EmailVerificationBanner } from './email-verification-banner';

describe('EmailVerificationBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 8, 19, 9, 0));
    auth.current = { user: { id: 'user-1', email: 'new@example.com' } };
    resendVerification.mockReset();
    resendVerification.mockResolvedValue({ accepted: true });
    toast.success.mockReset();
    toast.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says how long is left and where the link went', () => {
    render(<EmailVerificationBanner daysLeft={5} />);

    expect(screen.getByText(/verify your email — 5 days left/i)).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
  });

  it('calls the final day the last day', () => {
    render(<EmailVerificationBanner daysLeft={1} />);

    expect(screen.getByText(/verify your email — last day/i)).toBeInTheDocument();
  });

  it('resends the link and then holds off for the cooldown', async () => {
    render(<EmailVerificationBanner daysLeft={5} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
    });

    expect(resendVerification).toHaveBeenCalledWith({ email: 'new@example.com' });
    expect(toast.success).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /sent — check your inbox/i })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_MS);
    });

    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('passes on the rate limit’s answer when the API refuses a resend', async () => {
    resendVerification.mockRejectedValue(
      new ApiError('Request failed', 429, {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in 10 minutes.' },
      }),
    );
    render(<EmailVerificationBanner daysLeft={5} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Too many requests. Try again in 10 minutes.' }),
    );
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('stays dismissed for the rest of the day', () => {
    const { unmount } = render(<EmailVerificationBanner daysLeft={5} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss until tomorrow/i }));
    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();

    unmount();
    vi.setSystemTime(new Date(2026, 8, 19, 23, 30));
    render(<EmailVerificationBanner daysLeft={5} />);

    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();
  });

  it('comes back the next morning', () => {
    const { unmount } = render(<EmailVerificationBanner daysLeft={5} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss until tomorrow/i }));
    unmount();

    vi.setSystemTime(new Date(2026, 8, 20, 8, 0));
    render(<EmailVerificationBanner daysLeft={4} />);

    expect(screen.getByText(/verify your email — 4 days left/i)).toBeInTheDocument();
  });

  it('does not carry one account’s dismissal over to another on the same browser', () => {
    const { unmount } = render(<EmailVerificationBanner daysLeft={5} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss until tomorrow/i }));
    unmount();

    auth.current = { user: { id: 'user-2', email: 'other@example.com' } };
    render(<EmailVerificationBanner daysLeft={6} />);

    expect(screen.getByText(/verify your email — 6 days left/i)).toBeInTheDocument();
  });
});
