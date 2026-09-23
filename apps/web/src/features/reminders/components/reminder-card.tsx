import { Link } from '@tanstack/react-router';
import { BellRing, ChevronRight } from 'lucide-react';
import { ReminderStatus } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { Reminder } from '../types/reminder';
import { ReminderStatusBadge } from './reminder-status-badge';

type ReminderCardProps = {
  reminder: Reminder;
  selectionControl?: ReactNode;
  vehicleLabel?: string;
};

export function ReminderCard({ reminder, selectionControl, vehicleLabel }: ReminderCardProps) {
  // The target odometer is the card's only figure, and a reminder needs either that
  // or a date, so a date-only one has nothing to put in a figures strip. It gets no
  // strip at all then, rather than an empty band under its text holding the chevron.
  const dueOdometer = reminder.dueOdometer;
  const hasFigures = dueOdometer !== undefined;

  const chevron = (
    <div
      className={cn(
        'ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-primary',
        // With no strip to sit in, it rides the text's row, at the distance from the
        // card's edge the strip would have kept. A stacked card has no room to spare:
        // there it goes, rather than take 60px from a title that already truncates.
        !hasFigures && 'hidden @xl:mr-6 @xl:flex',
      )}
    >
      <ChevronRight className="h-4 w-4" />
    </div>
  );

  const urgencyColor =
    reminder.status === ReminderStatus.Overdue
      ? 'bg-rose-500'
      : reminder.status === ReminderStatus.DueToday
        ? 'bg-amber-500'
        : reminder.status === ReminderStatus.Completed
          ? 'bg-slate-300'
          : 'bg-primary';

  return (
    <div className="group relative flex items-center gap-2 sm:gap-4">
      {selectionControl ? <div className="shrink-0">{selectionControl}</div> : null}

      {/* The card fills anything from a phone to half a desktop panel, so its figures
          move beside the text by the card's own width (@xl, 36rem), not the screen's. */}
      <Card
        className={cn(
          '@container relative flex-1 overflow-hidden border-slate-200/60 bg-white/70 p-0 transition-all duration-300 hover:border-primary/20 hover:bg-white sm:p-5',
          reminder.status === ReminderStatus.Overdue && 'border-rose-200/60',
          reminder.status === ReminderStatus.DueToday && 'border-amber-200/60',
        )}
      >
        {/* Urgency Accent Bar */}
        <div className={cn('absolute left-0 top-0 bottom-0 w-1', urgencyColor)} />

        <Link
          className={cn(
            'flex p-0',
            hasFigures ? 'flex-col @xl:flex-row @xl:items-center' : 'items-center',
          )}
          params={{ reminderId: reminder.id }}
          to="/reminders/$reminderId"
        >
          {/* Main Content */}
          <div className="flex min-w-0 flex-1 items-center gap-4 p-3 pl-4 sm:p-5 sm:pl-6">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors sm:flex">
              <BellRing className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {reminder.title}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="bg-white text-[10px] font-bold uppercase tracking-widest"
                  >
                    {format.enumLabel('reminderType', reminder.type)}
                  </Badge>
                  <ReminderStatusBadge status={reminder.status} />
                </div>
              </div>
              <div className="flex flex-col gap-y-1 text-[13px] font-medium text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                {vehicleLabel ? <span>{vehicleLabel}</span> : null}
                {vehicleLabel ? <span className="hidden text-slate-300 sm:inline">•</span> : null}
                {reminder.dueDate ? (
                  <span>Due {format.date(reminder.dueDate)}</span>
                ) : (
                  <span>No date set</span>
                )}
                {reminder.status !== ReminderStatus.Completed && reminder.usageProjection ? (
                  <>
                    <span className="hidden text-slate-300 sm:inline">•</span>
                    <span
                      className="text-slate-500"
                      title={`Based on ${format.number(reminder.usageProjection.kmPerDay, { decimals: 1, fixed: true })} km/day from the last ${reminder.usageProjection.sampleDays} days of fuel logs (${reminder.usageProjection.confidence} confidence)`}
                    >
                      Projected ~{format.date(reminder.usageProjection.projectedDueDate)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Metrics & Action */}
          {hasFigures ? (
            <div
              className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-3 sm:p-4 @xl:border-l @xl:border-t-0 @xl:bg-transparent max-sm:@xl:px-6 max-sm:@xl:py-0"
              data-testid="reminder-figures"
            >
              <div className="flex items-center gap-8 @xl:gap-10">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Target ODO
                  </p>
                  <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                    {format.odometer(dueOdometer)}
                  </p>
                </div>
              </div>

              {chevron}
            </div>
          ) : (
            chevron
          )}
        </Link>
      </Card>
    </div>
  );
}
