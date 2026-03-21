import { Link } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { DashboardSummary } from '../types/dashboard';
import { DashboardQuickActions } from './dashboard-quick-actions';
import { formatMaintenanceCategory } from '@/features/maintenance/utils/format-maintenance-category';
import { formatReminderType } from '@/features/reminders/utils/format-reminder-type';
import { ReminderStatusBadge } from '@/features/reminders/components/reminder-status-badge';

type DashboardOverviewProps = {
  summary: DashboardSummary;
};

export function DashboardOverview({ summary }: DashboardOverviewProps) {
  const hasAnyData =
    summary.totalVehicles > 0 ||
    summary.totalMaintenanceRecords > 0 ||
    summary.totalAttachments > 0 ||
    Object.values(summary.reminderCounts).some((count) => count > 0);

  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        <DashboardQuickActions />
        <EmptyState
          action={
            <Link className={buttonVariants()} to="/vehicles/new">
              Add your first vehicle
            </Link>
          }
          description="Start with a vehicle, then log maintenance, reminders, and receipts as the ownership history grows."
          title="Your garage is empty"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Vehicles currently tracked in your garage."
          label="Total vehicles"
          value={String(summary.totalVehicles)}
        />
        <StatCard
          accent={<Badge tone="danger">Urgent</Badge>}
          description="Reminders already past their due date or odometer."
          label="Overdue reminders"
          value={String(summary.reminderCounts.overdue)}
        />
        <StatCard
          accent={<Badge tone="warning">Today</Badge>}
          description="Reminders that need attention today."
          label="Due today"
          value={String(summary.reminderCounts.dueToday)}
        />
        <StatCard
          accent={<Badge tone="accent">History</Badge>}
          description="Service entries logged across all vehicles."
          label="Maintenance records"
          value={String(summary.totalMaintenanceRecords)}
        />
      </div>

      <DashboardQuickActions />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardReminderSection
          description="Items that need attention before anything else."
          emptyMessage="No reminders are overdue right now."
          reminders={summary.overdueReminders}
          title="Overdue reminders"
        />
        <DashboardReminderSection
          description="The next reminders coming up across your vehicles."
          emptyMessage="No upcoming reminders exist yet."
          reminders={summary.upcomingReminders}
          title="Upcoming reminders"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Recent maintenance</CardTitle>
              <CardDescription>
                Your latest logged services and repairs, with receipt coverage.
              </CardDescription>
            </div>
            <Badge tone="neutral">{summary.totalAttachments} attachments</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentMaintenance.length ? (
              summary.recentMaintenance.map((record) => (
                <Link
                  key={record.id}
                  className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
                  params={{ recordId: record.id }}
                  to="/maintenance-records/$recordId"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">
                      {record.workshopName?.trim() || 'Workshop not specified'}
                    </p>
                    <Badge>{formatMaintenanceCategory(record.category)}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>{record.vehicleLabel}</p>
                    <p>{formatDate(record.serviceDate)}</p>
                    <p>{formatCurrency(record.totalCost)}</p>
                    <p>
                      {record.attachmentCount} attachment{record.attachmentCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                action={
                  <Link className={buttonVariants()} to="/vehicles">
                    Log maintenance from a vehicle
                  </Link>
                }
                description="No maintenance records have been logged yet."
                title="No maintenance history yet"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Garage overview</CardTitle>
            <CardDescription>
              Vehicles you recently added or updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentVehicles.length ? (
              summary.recentVehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
                  params={{ vehicleId: vehicle.id }}
                  to="/vehicles/$vehicleId"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{vehicle.displayName}</p>
                    <Badge tone="accent">{vehicle.vehicleType}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>{vehicle.registrationNumber}</p>
                    <p>{vehicle.odometer.toLocaleString('en-IN')} km</p>
                    <p>Updated {formatDate(vehicle.updatedAt)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                action={
                  <Link className={buttonVariants()} to="/vehicles/new">
                    Add a vehicle
                  </Link>
                }
                description="Vehicles will appear here once your garage starts growing."
                title="No vehicles to review"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type DashboardReminderSectionProps = {
  title: string;
  description: string;
  emptyMessage: string;
  reminders: DashboardSummary['upcomingReminders'];
};

function DashboardReminderSection({
  title,
  description,
  emptyMessage,
  reminders,
}: DashboardReminderSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {reminders.length ? (
          reminders.map((reminder) => (
            <Link
              key={reminder.id}
              className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
              params={{ reminderId: reminder.id }}
              to="/reminders/$reminderId"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{reminder.title}</p>
                    <Badge>{formatReminderType(reminder.type)}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>{reminder.vehicleLabel}</p>
                    {reminder.dueDate ? <p>Due date: {formatDate(reminder.dueDate)}</p> : null}
                    {reminder.dueOdometer !== undefined ? (
                      <p>Due odometer: {reminder.dueOdometer.toLocaleString('en-IN')} km</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ReminderStatusBadge status={reminder.status} />
                  {reminder.status === ReminderStatus.Overdue ? (
                    <Badge tone="danger">Urgent</Badge>
                  ) : reminder.status === ReminderStatus.DueToday ? (
                    <Badge tone="warning">Today</Badge>
                  ) : null}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
