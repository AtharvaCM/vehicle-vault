import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('toggles aria-checked and calls onCheckedChange', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Share with garage" onCheckedChange={onCheckedChange} />);

    const box = screen.getByRole('checkbox', { name: 'Share with garage' });
    expect(box).toHaveAttribute('aria-checked', 'false');

    await user.click(box);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders the check mark once checked', () => {
    render(<Checkbox aria-label="Share with garage" checked />);

    expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked');
  });
});
