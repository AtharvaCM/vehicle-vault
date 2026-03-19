import { ReminderStatus } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { useReminders } from '@/features/reminders/hooks/use-reminders';
import { groupRemindersByStatus } from '@/features/reminders/utils/group-reminders-by-status';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';

import { DashboardOverview } from '../components/dashboard-overview';

export function DashboardPage() {
  const vehiclesQuery = useVehicles();
  const remindersQuery = useReminders();
  const groupedReminders = remindersQuery.data ? groupRemindersByStatus(remindersQuery.data) : null;

  return (
    <PageContainer>
      <PageTitle
        description="Track the high-level state of your fleet, upcoming work, and items that need immediate attention."
        title="Dashboard"
      />

      <DashboardOverview
        dueTodayReminders={groupedReminders?.[ReminderStatus.DueToday] ?? []}
        isRemindersError={remindersQuery.isError}
        isRemindersPending={remindersQuery.isPending}
        overdueReminders={groupedReminders?.[ReminderStatus.Overdue] ?? []}
        totalVehicles={vehiclesQuery.data?.length ?? 0}
        upcomingReminders={groupedReminders?.[ReminderStatus.Upcoming] ?? []}
      />
    </PageContainer>
  );
}
