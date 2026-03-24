import { Link } from '@tanstack/react-router';
import { BellRing, ChevronRight } from 'lucide-react';
import { ReminderStatus } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format-date';

import type { Reminder } from '../types/reminder';
import { formatReminderType } from '../utils/format-reminder-type';
import { ReminderStatusBadge } from './reminder-status-badge';

type ReminderCardProps = {
  reminder: Reminder;
  selectionControl?: ReactNode;
  vehicleLabel?: string;
};

export function ReminderCard({ reminder, selectionControl, vehicleLabel }: ReminderCardProps) {
  const urgencyColor =
    reminder.status === ReminderStatus.Overdue
      ? 'bg-rose-500'
      : reminder.status === ReminderStatus.DueToday
        ? 'bg-amber-500'
        : reminder.status === ReminderStatus.Completed
          ? 'bg-slate-300'
          : 'bg-primary';

  return (
    <div className="group relative flex items-center gap-4">
      {selectionControl ? (
        <div className="flex-shrink-0">
          {selectionControl}
        </div>
      ) : null}
      
      <Card className={cn(
        "relative flex-1 overflow-hidden border-slate-200/60 bg-white/70 shadow-premium-sm transition-all duration-300 hover:border-primary/20 hover:bg-white hover:shadow-premium-md",
        reminder.status === ReminderStatus.Overdue && "border-rose-200/60",
        reminder.status === ReminderStatus.DueToday && "border-amber-200/60"
      )}>
        {/* Urgency Accent Bar */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1", urgencyColor)} />

        <Link className="flex flex-col p-0 md:flex-row md:items-center" params={{ reminderId: reminder.id }} to="/reminders/$reminderId">
          {/* Main Content */}
          <div className="flex flex-1 items-center gap-4 p-4 sm:p-5 pl-5 sm:pl-6">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <BellRing className="h-5 w-5" />
            </div>
            
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {reminder.title}
                </p>
                <div className="flex items-center gap-1.5">
                   <Badge variant="outline" className="bg-white text-[10px] font-bold uppercase tracking-widest">{formatReminderType(reminder.type)}</Badge>
                   <ReminderStatusBadge status={reminder.status} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-slate-500">
                {vehicleLabel ? <span>{vehicleLabel}</span> : null}
                {vehicleLabel ? <span className="text-slate-300">•</span> : null}
                {reminder.dueDate ? <span>Due {formatDate(reminder.dueDate)}</span> : <span>No date set</span>}
              </div>
            </div>
          </div>

          {/* Metrics & Action */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-4 md:border-l md:border-t-0 md:bg-transparent md:px-6 md:py-0">
            <div className="flex items-center gap-8 md:gap-10">
              {reminder.dueOdometer !== undefined ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target ODO</p>
                  <p className="text-[13px] font-semibold tabular-nums text-slate-700">{reminder.dueOdometer.toLocaleString('en-IN')} km</p>
                </div>
              ) : null}
            </div>

            <div className="ml-4 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-300 shadow-premium-sm transition-all group-hover:translate-x-1 group-hover:text-primary">
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      </Card>
    </div>
  );
}
