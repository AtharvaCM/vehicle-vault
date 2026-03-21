import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PasswordResetRequestForm } from './password-reset-request-form';

describe('PasswordResetRequestForm', () => {
  it('submits a normalized email when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PasswordResetRequestForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email address/i), '  user@example.com  ');
    await user.click(screen.getByRole('button', { name: /request password reset/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
  });

  it('renders submit errors from the server cleanly', () => {
    render(
      <PasswordResetRequestForm
        onSubmit={vi.fn()}
        submitError="Unable to start the password reset flow right now."
      />,
    );

    expect(screen.getByText('Unable to start the password reset flow right now.')).toBeInTheDocument();
  });
});
