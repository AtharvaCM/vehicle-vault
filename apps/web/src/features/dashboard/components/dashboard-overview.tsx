import { Bell } from 'lucide-react';
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

type DashboardReminderSectionProps = {
  title: string;
  description: string;
  emptyMessage: string;
  reminders: DashboardSummary['upcomingReminders'];
};
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
      <div className="space-y-8">
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
    <div className="space-y-8 pb-10">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
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

      <div className="grid gap-8 xl:grid-cols-2">
        <Card className="bg-white/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Recent maintenance</CardTitle>
              <CardDescription>Latest logged services and repairs.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-white shadow-premium-sm">
              {summary.totalAttachments} attachments
            </Badge>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {summary.recentMaintenance.length ? (
              summary.recentMaintenance.map((record) => (
                <Link
                  key={record.id}
                  className="group flex flex-col gap-2 p-5 transition-all hover:bg-slate-50/80"
                  params={{ recordId: record.id }}
                  to="/maintenance-records/$recordId"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {record.workshopName?.trim() || 'Workshop not specified'}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {formatMaintenanceCategory(record.category)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[13px] text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>{record.vehicleLabel}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                      <span>{formatDate(record.serviceDate)}</span>
                    </div>
                    <p className="font-bold text-slate-700">{formatCurrency(record.totalCost)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-5 py-8">
                <EmptyState
                  action={
                    <Link className={buttonVariants({ size: 'sm' })} to="/vehicles">
                      Log maintenance
                    </Link>
                  }
                  description="No maintenance records have been logged yet."
                  title="No history yet"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Garage overview</CardTitle>
              <CardDescription>Recently added or updated vehicles.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {summary.recentVehicles.length ? (
              summary.recentVehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  className="group flex flex-col gap-2 p-5 transition-all hover:bg-slate-50/80"
                  params={{ vehicleId: vehicle.id }}
                  to="/vehicles/$vehicleId"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {vehicle.displayName}
                    </p>
                    <Badge tone="accent">{vehicle.vehicleType}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[13px] text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">{vehicle.registrationNumber}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                      <span className="tabular-nums">
                        {vehicle.odometer.toLocaleString('en-IN')} km
                      </span>
                    </div>
                    <p className="text-[11px] font-medium opacity-60">
                      Updated {formatDate(vehicle.updatedAt)}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-5 py-8">
                <EmptyState
                  action={
                    <Link className={buttonVariants({ size: 'sm' })} to="/vehicles/new">
                      Add a vehicle
                    </Link>
                  }
                  description="Vehicles will appear here once your garage grows."
                  title="No vehicles"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardReminderSection({
  title,
  description,
  emptyMessage,
  reminders,
}: DashboardReminderSectionProps) {
  return (
    <Card className="bg-white/60 overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-5">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-[13px]">{description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        {reminders.length ? (
          reminders.map((reminder) => (
            <Link
              key={reminder.id}
              className="group flex flex-col gap-3 p-5 transition-all hover:bg-slate-50/80"
              params={{ reminderId: reminder.id }}
              to="/reminders/$reminderId"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
                      {reminder.title}
                    </p>
                    <Badge variant="outline" className="bg-white text-[10px] py-0">
                      {formatReminderType(reminder.type)}
                    </Badge>
                  </div>
                  <p className="text-[12px] font-medium text-slate-500">{reminder.vehicleLabel}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <ReminderStatusBadge status={reminder.status} />
                  {reminder.status === ReminderStatus.Overdue ? (
                    <Badge tone="danger" className="animate-pulse">
                      Urgent
                    </Badge>
                  ) : reminder.status === ReminderStatus.DueToday ? (
                    <Badge tone="warning">Today</Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-4 text-[12px] text-slate-500 font-medium">
                {reminder.dueDate ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Date</span>
                    <span className="text-slate-700">{formatDate(reminder.dueDate)}</span>
                  </div>
                ) : null}
                {reminder.dueOdometer !== undefined ? (
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                    <span className="text-slate-400">KM</span>
                    <span className="text-slate-700 tabular-nums">
                      {reminder.dueOdometer.toLocaleString('en-IN')} km
                    </span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))
        ) : (
          <div className="px-6 py-10 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <Bell className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-medium text-slate-400">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
