import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './date-picker';

// Built from local date parts, not `toISOString` (UTC), which shifts the
// date in any zone ahead of UTC, including IST.
function isoDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ControlledDatePicker({ onChange }: { onChange: (date: Date | undefined) => void }) {
  const [value, setValue] = useState<Date | undefined>(undefined);

  return (
    <DatePicker
      onChange={(date) => {
        setValue(date);
        onChange(date);
      }}
      placeholder="Pick a date"
      value={value}
    />
  );
}

describe('DatePicker', () => {
  it('opens the calendar popover from the trigger', async () => {
    const user = userEvent.setup();
    render(<ControlledDatePicker onChange={vi.fn()} />);

    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pick a date' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('calls onChange and shows the formatted date on the trigger once a day is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledDatePicker onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Pick a date' }));

    const dialog = await screen.findByRole('dialog');
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const dayButton = within(dialog).getByRole('button', {
      name: (_, element) => element.getAttribute('data-day-iso') === isoDay(firstOfMonth),
    });

    await user.click(dayButton);

    expect(onChange).toHaveBeenCalledWith(firstOfMonth);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\d{4}/ })).toBeInTheDocument();
  });
});
