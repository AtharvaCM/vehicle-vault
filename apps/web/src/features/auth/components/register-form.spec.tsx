import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  it('submits trimmed values when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^your name$/i), '  Atharva  ');
    await user.type(screen.getByLabelText(/email address/i), '  atharva@example.com  ');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Atharva',
      email: 'atharva@example.com',
      password: 'password123',
    });
  });

  it('shows the length rule as met once the password is long enough', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={vi.fn()} />);

    const rule = screen.getByText('At least 8 characters');
    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute('aria-describedby', expect.stringContaining(rule.id));
    await user.type(password, 'short');
    expect(rule).not.toHaveAttribute('data-met');
    await user.type(password, '123');
    expect(rule).toHaveAttribute('data-met');
  });

  it('renders submit errors from the server cleanly', () => {
    render(
      <RegisterForm onSubmit={vi.fn()} submitError="An account with this email already exists." />,
    );

    expect(screen.getByText('An account with this email already exists.')).toBeInTheDocument();
  });
});

describe('RegisterForm validation', () => {
  it('leaves checking to its own inline messages, not the browser’s bubble', () => {
    const { container } = render(<RegisterForm onSubmit={vi.fn()} />);

    expect(container.querySelector('form')).toHaveAttribute('novalidate');
  });
});
