import type { ReactNode } from 'react';
import type { UpcomingGroup } from '@vehicle-vault/shared';

import { StatusDot } from '@/components/shared/status-pill';
import { cn } from '@/lib/utils';

import { UPCOMING_GROUP_STATUS } from './upcoming-row';

const GROUP_WORDS: Record<UpcomingGroup, string> = {
  late: 'Late',
  this_week: 'This week',
  this_month: 'This month',
  later: 'Later',
};

type UpcomingGroupProps = {
  group: UpcomingGroup;
  /** Total in the group; the `later` group may hold more than are rendered. */
  count: number;
  children: ReactNode;
  /** Shown instead of rows when count is 0. */
  emptyText: string;
  /** e.g. a "Show more" button for `later`. */
  footer?: ReactNode;
  className?: string;
};

/**
 * One section of the Upcoming timeline: a status dot and the group's name and
 * count, then its rows (or, empty, a muted line explaining why). The heading
 * is a real `h2` so a screen reader can jump straight from "Late" to "This week".
 */
export function UpcomingGroup({
  group,
  count,
  children,
  emptyText,
  footer,
  className,
}: UpcomingGroupProps) {
  const headingId = `upcoming-group-${group}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={className}
      data-testid={`upcoming-group-${group}`}
    >
      <div className="flex items-baseline gap-1.5 px-5 pb-1 pt-3">
        <h2 className="text-ui font-semibold" id={headingId}>
          <StatusDot status={UPCOMING_GROUP_STATUS[group]}>{GROUP_WORDS[group]}</StatusDot>
        </h2>
        <span className="text-small text-fg-3">· {count}</span>
      </div>
      {count === 0 ? (
        <p className={cn('px-5 pb-3 text-small text-fg-3')}>{emptyText}</p>
      ) : (
        <>
          <div className="divide-y divide-line-subtle">{children}</div>
          {footer}
        </>
      )}
    </section>
  );
}
