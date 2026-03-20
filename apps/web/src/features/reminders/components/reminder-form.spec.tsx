import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReminderForm } from './reminder-form';

describe('ReminderForm', () => {
  it('requires a due date or due odometer before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ReminderForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^title$/i), 'Insurance renewal');
    await user.click(screen.getByRole('button', { name: /save reminder/i }));

    await waitFor(() => {
      expect(screen.getByText('Add a due date or due odometer')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('converts date input to an ISO string before submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ReminderForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^title$/i), 'Insurance renewal');
    await user.type(screen.getByLabelText(/due date/i), '2026-03-25');
    await user.click(screen.getByRole('button', { name: /save reminder/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Insurance renewal',
        type: 'service',
        dueDate: '2026-03-25T00:00:00.000Z',
        dueOdometer: undefined,
        notes: undefined,
      });
    });
  });
});
