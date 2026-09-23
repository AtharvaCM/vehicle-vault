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
        repeatEveryMonths: null,
        repeatEveryKm: null,
      });
    });
  });

  it('says a reminder does not repeat until a rule is chosen', () => {
    render(<ReminderForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: /repeats/i })).toHaveTextContent('Doesn’t repeat');
    expect(screen.getByText('Marking it done ends it.')).toBeInTheDocument();
  });

  it('fills a yearly rule from the Insurance quick fill', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ReminderForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Insurance' }));
    await user.type(screen.getByLabelText(/due date/i), '2027-03-01');
    await user.click(screen.getByRole('button', { name: /save reminder/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Insurance renewal',
          type: 'insurance',
          repeatEveryMonths: 12,
          repeatEveryKm: null,
        }),
      );
    });
  });

  it('fills a 6-month rule from the PUC quick fill', async () => {
    const user = userEvent.setup();

    render(<ReminderForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'PUC' }));

    expect(screen.getByRole('combobox', { name: /repeats/i })).toHaveTextContent('Every 6 months');
  });

  it('fills 10,000 km or 12 months, whichever first, from the Oil change quick fill', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ReminderForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Oil change' }));

    expect(screen.getByLabelText(/every \(months\)/i)).toHaveValue(12);
    expect(screen.getByLabelText(/every \(km\)/i)).toHaveValue(10000);
    expect(screen.getByText(/whichever comes first/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/due odometer/i), '25000');
    await user.click(screen.getByRole('button', { name: /save reminder/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ repeatEveryMonths: 12, repeatEveryKm: 10000 }),
      );
    });
  });

  it('asks for a distance when repeating by km', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ReminderForm
        initialValues={{ title: 'Chain lube', dueOdometer: 12000, repeat: 'distance' }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save reminder/i }));

    expect(await screen.findByText('Enter how many km between reminders')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a stored rule when editing and keeps it on save', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ReminderForm
        initialValues={{
          title: 'Insurance renewal',
          dueDate: '2027-03-01',
          repeat: 'yearly',
          repeatEveryMonths: 12,
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('combobox', { name: /repeats/i })).toHaveTextContent('Every year');

    await user.click(screen.getByRole('button', { name: /save reminder/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ repeatEveryMonths: 12, repeatEveryKm: null }),
      );
    });
  });
});
