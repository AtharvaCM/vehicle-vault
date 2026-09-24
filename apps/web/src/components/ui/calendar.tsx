import type * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ChevronProps, DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';

type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * The calendar day as `YYYY-MM-DD` in local time, for the `data-day-iso` test
 * hook below. `toISOString` converts to UTC first, which shifts the date in
 * any zone ahead of it (including IST) and would silently pick the wrong day.
 */
function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Restyled onto the design tokens; Monday is the first day of the week
 * (India), and the touch target grows to 44px below `md`.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  weekStartsOn = 1,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('flex flex-col gap-4 sm:flex-row', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-3', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between px-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          'inline-flex size-9 items-center justify-center rounded-control text-fg-2 transition-colors outline-hidden hover:bg-page hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          'inline-flex size-9 items-center justify-center rounded-control text-fg-2 transition-colors outline-hidden hover:bg-page hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-9 w-full items-center justify-center text-body font-medium text-fg',
          defaultClassNames.month_caption,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 select-none text-center text-caption font-normal text-fg-3',
          defaultClassNames.weekday,
        ),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        day: cn(
          'group/day relative aspect-square size-11 p-0 text-center md:size-9',
          defaultClassNames.day,
        ),
        range_start: cn('rounded-l-control bg-brand-tint', defaultClassNames.range_start),
        range_middle: cn('rounded-none bg-brand-tint', defaultClassNames.range_middle),
        range_end: cn('rounded-r-control bg-brand-tint', defaultClassNames.range_end),
        today: cn('rounded-control bg-brand-tint text-brand', defaultClassNames.today),
        outside: cn('text-fg-3 aria-selected:text-fg-3', defaultClassNames.outside),
        disabled: cn('text-fg-3 opacity-40', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
      }}
      showOutsideDays={showOutsideDays}
      weekStartsOn={weekStartsOn}
      {...props}
    />
  );
}

function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
  return orientation === 'left' ? (
    <ChevronLeft className={cn('size-4', className)} {...props} />
  ) : (
    <ChevronRight className={cn('size-4', className)} {...props} />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <button
      className={cn(
        'flex size-11 items-center justify-center rounded-control text-body font-normal text-fg transition-colors outline-hidden hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 md:size-9 md:text-small',
        'data-[selected-single=true]:bg-brand data-[selected-single=true]:text-on-brand data-[selected-single=true]:hover:bg-brand data-[range-start=true]:bg-brand data-[range-start=true]:text-on-brand data-[range-end=true]:bg-brand data-[range-end=true]:text-on-brand',
        className,
      )}
      data-day-iso={localIsoDate(day.date)}
      data-range-end={modifiers.range_end}
      data-range-start={modifiers.range_start}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      type="button"
      {...props}
    />
  );
}

export { Calendar };
