import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

function Range() {
  const [range, setRange] = useState('30d');

  return (
    <ToggleGroup
      aria-label="Range"
      onValueChange={(value) => {
        if (value) setRange(value);
      }}
      type="single"
      value={range}
    >
      <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
      <ToggleGroupItem value="90d">90 days</ToggleGroupItem>
    </ToggleGroup>
  );
}

describe('ToggleGroup', () => {
  it('reports the selected value as a single-select radio group', async () => {
    const user = userEvent.setup();
    render(<Range />);

    const group = screen.getByRole('radiogroup', { name: 'Range' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '30 days' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: '90 days' }));

    expect(screen.getByRole('radio', { name: '90 days' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '30 days' })).toHaveAttribute('aria-checked', 'false');
  });

  it('ignores deselection, keeping the last value selected', async () => {
    const user = userEvent.setup();
    render(<Range />);

    await user.click(screen.getByRole('radio', { name: '30 days' }));

    expect(screen.getByRole('radio', { name: '30 days' })).toHaveAttribute('aria-checked', 'true');
  });
});
