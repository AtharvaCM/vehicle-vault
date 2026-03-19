import { Link } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/shared/stat-card';
import { buttonVariants } from '@/components/ui/button';
import type { Reminder } from '@/features/reminders/types/reminder';
import { ReminderList } from '@/features/reminders/components/reminder-list';

type DashboardOverviewProps = {
  dueTodayReminders: Reminder[];
  isRemindersError: boolean;
  isRemindersPending: boolean;
  overdueReminders: Reminder[];
  totalVehicles: number;
  upcomingReminders: Reminder[];
};

export function DashboardOverview({
  dueTodayReminders,
  isRemindersError,
  isRemindersPending,
  overdueReminders,
  totalVehicles,
  upcomingReminders,
}: DashboardOverviewProps) {
  const topUpcomingReminders = [
    ...overdueReminders,
    ...dueTodayReminders,
    ...upcomingReminders,
  ].slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          description="Active vehicles ready to attach service history, reminders, and documents."
          label="Vehicles"
          value={String(totalVehicles)}
        />
        <StatCard
          accent={<Badge tone="danger">Attention</Badge>}
          description="Reminders that are already past due."
          label="Overdue reminders"
          value={String(overdueReminders.length)}
        />
        <StatCard
          accent={<Badge tone="warning">Today</Badge>}
          description="Reminders that are due today."
          label="Due today"
          value={String(dueTodayReminders.length)}
        />
        <StatCard
          accent={<Badge tone="accent">Planned</Badge>}
          description="Upcoming reminders that are not due yet."
          label="Upcoming"
          value={String(upcomingReminders.length)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {isRemindersPending ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading reminder summary</CardTitle>
              <CardDescription>Fetching reminder data for the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Please wait while dashboard reminder widgets load.
            </CardContent>
          </Card>
        ) : isRemindersError ? (
          <Card>
            <CardHeader>
              <CardTitle>Reminder summary unavailable</CardTitle>
              <CardDescription>The reminder API could not be reached.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Dashboard counts depend on live reminder data. Check the API and refresh.
            </CardContent>
          </Card>
        ) : (
          <ReminderList
            description="The most urgent reminder items across the workspace."
            emptyMessage="No reminders exist yet."
            reminders={topUpcomingReminders}
            title="Recent / Upcoming Reminders"
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Reminder workflow</CardTitle>
            <CardDescription>How this slice stays intentionally lightweight.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Reminder status is computed from due date and odometer thresholds returned by the API.
            </p>
            <p>Completion is a direct user action, not a scheduler or notification workflow.</p>
            <p>Use vehicle reminder pages to create or manage reminders in context.</p>
            <Link className={buttonVariants({ size: 'sm', variant: 'secondary' })} to="/reminders">
              Open All Reminders
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
