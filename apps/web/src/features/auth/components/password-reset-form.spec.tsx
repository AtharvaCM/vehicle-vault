import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PasswordResetForm } from './password-reset-form';

describe('PasswordResetForm', () => {
  it('submits the reset token and password when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PasswordResetForm initialToken="preview-token" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^new password$/i), 'updated-password123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'updated-password123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      password: 'updated-password123',
      token: 'preview-token',
    });
  });

  it('shows a mismatch error when the confirmation does not match', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PasswordResetForm initialToken="preview-token" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^new password$/i), 'updated-password123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'different-password123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });
});
