import type { ReactNode } from 'react';

import { format } from '@/lib/format';

import type { NextDue, ScheduledNextDue } from '../utils/next-due-from-schedule';

/** "42,000 km or 23 Sep 2027, whichever first." */
export function describeNextDue(due: NextDue): string {
  const km = due.odometer !== undefined ? format.odometer(due.odometer) : undefined;
  const on = due.date ? format.date(due.date) : undefined;

  if (km && on) return `${km} or ${on}, whichever first.`;
  if (km) return `At ${km}.`;
  return `On ${on ?? format.EMPTY}.`;
}

/** What the next-due line can say. */
export type NextDueState =
  | Exclude<ScheduledNextDue, { kind: 'due' }>
  | { kind: 'due'; due: NextDue; fromBill?: boolean }
  | { kind: 'loading' }
  | { kind: 'unset' };

type NextDueSummaryProps = {
  /** "oil change": the work, as a sentence names it. */
  work: string;
  state: NextDueState;
  /** Change or Add, beside the line. */
  action?: ReactNode;
  /** The next-due fields, when open. */
  children?: ReactNode;
};

/**
 * The next one of this service, said before saving: worked out from the
 * vehicle's schedule, or what the bill or the owner gave. It is exactly what
 * the save sends as the record's next due, which the API turns into a reminder.
 */
export function NextDueSummary({ work, state, action, children }: NextDueSummaryProps) {
  let line: ReactNode;

  switch (state.kind) {
    case 'due':
      line = (
        <>
          {describeNextDue(state.due)} {state.fromBill ? 'As on the bill. ' : ''}We&apos;ll remind
          you.
        </>
      );
      break;
    case 'unscheduled':
      line = 'No schedule for this work. Add it if the workshop said when to come back.';
      break;
    case 'superseded':
      line = `A later ${work} is already logged, so this one sets no reminder.`;
      break;
    case 'passed':
      line = 'By the schedule the next one would already be due, so no reminder is set.';
      break;
    case 'loading':
      line = 'Working it out from the schedule…';
      break;
    case 'unset':
      line = 'Not set. Add it if the workshop said when to come back.';
      break;
  }

  return (
    <div className="flex flex-col gap-3 py-3" data-testid="next-due">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-medium text-fg">Next {work}</span>
          <span className="text-ui text-fg-2">{line}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
