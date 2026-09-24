import { format, type DateInput } from '@/lib/format';
import { dayMonthInContext, toValidDate } from '@/lib/format/date';
import { cn } from '@/lib/utils';

import { dueStatus, StatusDot, type DueStatusOptions } from './status-pill';

type DueLineProps = DueStatusOptions & {
  date: DateInput;
  /** Days already counted elsewhere (the attention queue's UTC days), so words and bucket agree. */
  days?: number | null;
  now?: Date;
  /** `inline`: "3 days late · Ended 20 Sep". `stacked`: the date on a line of its own, for row ends. */
  layout?: 'inline' | 'stacked';
  className?: string;
};

/**
 * When something is due or runs out, as the design language says it: the
 * time in words in the status colour, then the date itself.
 *
 * - due: "3 days late · Due 20 Sep", "Today · Wed 23 Sep", "In 4 days · Sat 27 Sep"
 * - ends: "3 days late · Ended 20 Sep", "153 days left · Ends 23 Feb 2027"
 */
export function DueLine({
  date,
  days,
  now = new Date(),
  mode = 'due',
  lapsed,
  soonWithin,
  layout = 'inline',
  className,
}: DueLineProps) {
  const parsed = toValidDate(date);
  const count = days ?? format.daysUntil(parsed, now);
  const status = dueStatus(count, { mode, lapsed, soonWithin });

  if (!parsed || count === null || !status) {
    return <span className={cn('text-small text-fg-3', className)}>{format.EMPTY}</span>;
  }

  const past = count < 0;
  // A lapsed warranty simply ended; anything else past its date is late.
  const quietlyEnded = past && status === 'ended';
  const words = format.relativeDue(parsed, {
    mode: mode === 'ends' && (quietlyEnded || !past) ? 'ends' : 'due',
    now,
    days: count,
  });

  // The weekday helps only ahead of time: "Sat 27 Sep", but "Ended 20 Sep".
  const when =
    count >= 0 && count <= 7 ? format.date(parsed, 'short') : dayMonthInContext(parsed, now);
  // "Ended 20 Sep" already says it all for a lapsed warranty.
  let detail: string | null = when;
  if (quietlyEnded) detail = null;
  else if (mode === 'ends' && past) detail = `Ended ${when}`;
  else if (mode === 'ends' && count > 0) detail = `Ends ${when}`;
  else if (past) detail = `Due ${when}`;

  return (
    <span
      className={cn(
        layout === 'stacked'
          ? 'inline-flex flex-col items-end gap-0.5'
          : 'inline-flex flex-wrap items-center gap-x-1.5',
        className,
      )}
      data-slot="due-line"
      data-status={status}
    >
      <StatusDot status={status}>{words}</StatusDot>
      {detail ? (
        <span className="text-caption text-fg-3">
          {layout === 'inline' ? <span aria-hidden="true">· </span> : null}
          {detail}
        </span>
      ) : null}
    </span>
  );
}
