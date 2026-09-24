import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The product's status vocabulary (docs/design-language.md, "Say when, not
 * just what"):
 *
 * - `late`: overdue, expired, an error. Brake red.
 * - `soon`: due today or this week. Indicator amber.
 * - `ok`: valid, done, all clear. PUC green.
 * - `ended`: lapsed but not urgent, like a warranty that ran out. Grey.
 * - `draft`: saved but not confirmed yet. A hollow dot.
 * - `info`: neutral news worth a look, or a task that is coming up but not yet close. Brand teal.
 */
export type Status = 'late' | 'soon' | 'ok' | 'ended' | 'draft' | 'info';

const TEXT: Record<Status, string> = {
  late: 'text-late',
  soon: 'text-soon',
  ok: 'text-ok',
  ended: 'text-ended',
  draft: 'text-fg-2',
  info: 'text-brand',
};

const DOT: Record<Status, string> = {
  late: 'bg-late',
  soon: 'bg-soon-dot',
  ok: 'bg-ok',
  ended: 'bg-ended-dot',
  draft: 'border-[1.5px] border-fg-3',
  info: 'bg-brand',
};

const TINT: Record<Status, string> = {
  late: 'bg-late-tint',
  soon: 'bg-soon-tint',
  ok: 'bg-ok-tint',
  ended: 'bg-page',
  draft: 'bg-page',
  info: 'bg-brand-tint',
};

type StatusProps = {
  status: Status;
  /**
   * The words: required, because status is never told by colour alone. Say
   * when where there is a when: "3 days late", "Today", "153 days left".
   */
  children: ReactNode;
  className?: string;
};

/** The coloured dot on its own. Decorative: always sits beside the words it colours. */
export function StatusMark({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 shrink-0 rounded-full', DOT[status], className)}
      data-slot="status-mark"
    />
  );
}

/** A dot and words in the status colour, set in running text or a row: "● 3 days late". */
export function StatusDot({ status, children, className }: StatusProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-small font-semibold',
        TEXT[status],
        className,
      )}
      data-slot="status-dot"
      data-status={status}
    >
      <StatusMark status={status} />
      {children}
    </span>
  );
}

/** The same on a tinted chip, where a status labels a whole card or slip. */
export function StatusPill({ status, children, className }: StatusProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap',
        TEXT[status],
        TINT[status],
        className,
      )}
      data-slot="status-pill"
      data-status={status}
    >
      <StatusMark status={status} />
      {children}
    </span>
  );
}

export type DueStatusOptions = {
  /**
   * `due`: something to do by the date; late once it passes.
   * `ends`: something valid until the date; see `lapsed`.
   */
  mode?: 'due' | 'ends';
  /** What a date in the past means in `ends` mode: `late` (insurance, PUC) or `ended` (a warranty). Default `late`. */
  lapsed?: 'late' | 'ended';
  /** Days ahead that still count as soon. Default 7, "this week". */
  soonWithin?: number;
};

/** The status for a day count from `format.daysUntil`: negative has passed, 0 is today. */
export function dueStatus(
  days: number | null | undefined,
  { mode = 'due', lapsed = 'late', soonWithin = 7 }: DueStatusOptions = {},
): Status | null {
  if (days === null || days === undefined) return null;
  if (days < 0) return mode === 'ends' ? lapsed : 'late';
  if (days <= soonWithin) return 'soon';

  // Later than that: a paper still valid is all clear; a task is simply coming up.
  return mode === 'ends' ? 'ok' : 'info';
}
