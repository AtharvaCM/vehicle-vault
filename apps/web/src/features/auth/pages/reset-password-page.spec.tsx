import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const resetPassword = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const location = vi.hoisted(() => ({ current: { searchStr: '?token=link-token' } }));

vi.mock('../api/reset-password', () => ({ resetPassword }));
vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => location.current,
  useNavigate: () => navigate,
}));

import { ResetPasswordPage } from './reset-password-page';

async function submitNewPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^new password$/i), 'updated-password123');
  await user.type(screen.getByLabelText(/confirm new password/i), 'updated-password123');
  await user.click(screen.getByRole('button', { name: /reset password/i }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    location.current = { searchStr: '?token=link-token' };
    resetPassword.mockResolvedValue({ reset: true });
  });

  it('sends the link’s token from the address, never from a field', async () => {
    render(<ResetPasswordPage />);

    expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();

    await submitNewPassword();

    expect(resetPassword).toHaveBeenCalledWith({
      password: 'updated-password123',
      token: 'link-token',
    });
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('says a link without a token is incomplete, and offers a new one', () => {
    location.current = { searchStr: '' };

    render(<ResetPasswordPage />);

    expect(screen.getAllByText('This reset link is incomplete')).not.toHaveLength(0);
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('replaces the form when the link has expired or was used', async () => {
    resetPassword.mockRejectedValue(new ApiError('Invalid or expired password reset token.', 401));

    render(<ResetPasswordPage />);
    await submitNewPassword();

    expect(
      await screen.findAllByText('This link has expired or was already used'),
    ).not.toHaveLength(0);
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });
});
