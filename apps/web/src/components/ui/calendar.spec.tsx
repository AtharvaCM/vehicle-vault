import { useState } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Calendar } from './calendar';

// react-day-picker doesn't set aria-selected or a grid role in this version,
// so day cells are found through the stable `data-day-iso` hook instead.
// Built from local date parts, not `toISOString` (UTC), which shifts the
// date in any zone ahead of UTC, including IST.
function isoDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SingleCalendar({ onSelect }: { onSelect: (date: Date | undefined) => void }) {
  const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 8, 23));

  return (
    <Calendar
      defaultMonth={new Date(2026, 8, 1)}
      mode="single"
      onSelect={(date) => {
        setSelected(date);
        onSelect(date);
      }}
      selected={selected}
    />
  );
}

describe('Calendar', () => {
  it('marks the selected day and calls onSelect when another day is picked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<SingleCalendar onSelect={onSelect} />);

    const selectedDay = new Date(2026, 8, 23);
    const nextDay = new Date(2026, 8, 24);

    expect(container.querySelector(`[data-day-iso="${isoDay(selectedDay)}"]`)).toHaveAttribute(
      'data-selected-single',
      'true',
    );

    await user.click(container.querySelector(`[data-day-iso="${isoDay(nextDay)}"]`) as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith(nextDay);
  });

  it('starts the week on Monday', () => {
    const { container } = render(<Calendar defaultMonth={new Date(2026, 8, 1)} mode="single" />);

    const weekdays = container.querySelectorAll('.rdp-weekday');
    expect(weekdays[0]).toHaveTextContent('Mo');
  });
});
