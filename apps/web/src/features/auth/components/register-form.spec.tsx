import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  it('submits trimmed values when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name$/i), '  Atharva  ');
    await user.type(screen.getByLabelText(/email address/i), '  atharva@example.com  ');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Atharva',
      email: 'atharva@example.com',
      password: 'password123',
    });
  });

  it('renders submit errors from the server cleanly', () => {
    render(<RegisterForm onSubmit={vi.fn()} submitError="An account with this email already exists." />);

    expect(screen.getByText('An account with this email already exists.')).toBeInTheDocument();
  });
});
