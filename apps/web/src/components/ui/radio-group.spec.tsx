import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup, RadioGroupItem } from './radio-group';

describe('RadioGroup', () => {
  it('selects an item on click and reports the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange}>
        <RadioGroupItem aria-label="Petrol" value="petrol" />
        <RadioGroupItem aria-label="Diesel" value="diesel" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio', { name: 'Diesel' }));

    expect(onValueChange).toHaveBeenCalledWith('diesel');
  });

  it('moves selection with arrow keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="petrol" onValueChange={onValueChange}>
        <RadioGroupItem aria-label="Petrol" value="petrol" />
        <RadioGroupItem aria-label="Diesel" value="diesel" />
      </RadioGroup>,
    );

    await user.tab();
    // Radix moves roving focus in a `setTimeout` and only selects on focus
    // while its "arrow key is down" flag is still set (radio-group #340), so
    // the key has to still be held when that timeout fires.
    await user.keyboard('{ArrowDown>}');
    await vi.waitFor(() => expect(onValueChange).toHaveBeenCalledWith('diesel'));
    await user.keyboard('{/ArrowDown}');
  });
});
