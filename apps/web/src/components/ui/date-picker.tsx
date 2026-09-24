import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type DatePickerProps = {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  /** Earliest selectable day. */
  fromDate?: Date;
  /** Latest selectable day. */
  toDate?: Date;
  className?: string;
};

/** A text-input-styled trigger over `Calendar`, opened in a `Popover`. */
function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  id,
  'aria-invalid': ariaInvalid,
  fromDate,
  toDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const disabledMatcher = React.useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (fromDate) matchers.push({ before: fromDate });
    if (toDate) matchers.push({ after: toDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [fromDate, toDate]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-invalid={ariaInvalid}
          className={cn(
            'flex h-12 w-full items-center gap-2 rounded-control border border-line bg-surface px-3 text-left text-body text-fg outline-hidden aria-invalid:border-late focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-10',
            !value && 'text-fg-3',
            className,
          )}
          disabled={disabled}
          id={id}
          type="button"
        >
          <CalendarDays className="size-4 shrink-0 text-fg-3" />
          <span className="flex-1 truncate">{value ? format.date(value) : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          disabled={disabledMatcher}
          mode="single"
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          selected={value}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
