import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { confirm, ConfirmHost } from './confirm';

function ask(options: Parameters<typeof confirm>[0] = { title: 'Delete this fuel log?' }) {
  let answer!: Promise<boolean>;
  act(() => {
    answer = confirm(options);
  });
  return answer;
}

describe('confirm', () => {
  // The queue is module state: every test answers what it asks, so none leaks into the next.
  it('asks in an alert dialog named by its title and description', async () => {
    render(<ConfirmHost />);
    const answer = ask({
      title: 'Delete this fuel log?',
      description: "It can't be undone.",
      confirmLabel: 'Delete',
    });

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this fuel log?' });
    expect(dialog).toHaveAccessibleDescription("It can't be undone.");
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await answer;
  });

  it('resolves true when confirmed and closes', async () => {
    render(<ConfirmHost />);
    const answer = ask({ title: 'Delete this fuel log?', confirmLabel: 'Delete' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('resolves false on Cancel, and Cancel has the initial focus', async () => {
    render(<ConfirmHost />);
    const answer = ask();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);

    await expect(answer).resolves.toBe(false);
  });

  it('resolves false on Escape', async () => {
    render(<ConfirmHost />);
    const answer = ask();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    await expect(answer).resolves.toBe(false);
  });

  it('asks queued questions one at a time', async () => {
    render(<ConfirmHost />);
    const first = ask({ title: 'First?' });
    const second = ask({ title: 'Second?', confirmLabel: 'Yes' });

    expect(screen.getByRole('alertdialog', { name: 'First?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(first).resolves.toBe(false);

    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    await expect(second).resolves.toBe(true);
  });

  it('draws a destructive confirm in the late colour', async () => {
    render(<ConfirmHost />);
    const answer = ask({ title: 'Delete?', confirmLabel: 'Delete', destructive: true });

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('bg-destructive');

    fireEvent.click(button);
    await answer;
  });
});
