import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('submits trimmed values when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email address/i), '  user@example.com  ');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('renders submit errors from the server cleanly', () => {
    render(<LoginForm onSubmit={vi.fn()} submitError="Invalid email or password." />);

    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });
});
