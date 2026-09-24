import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { SectionHeader } from '@/components/shared/section-header';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { ReminderCard } from '@/features/reminders/components/reminder-card';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';

import { useVehicleAccess } from '../context/vehicle-access';

type ReminderPanelProps = {
  vehicleId: string;
  remindersQuery: ReturnType<typeof useVehicleReminders>;
  visibleReminders: ReturnType<typeof useVehicleReminders>['data'];
  title?: string;
  visibleCount?: number | undefined;
};

export function ReminderPanel({
  vehicleId,
  remindersQuery,
  visibleReminders,
  title = 'Upcoming reminders',
  visibleCount = 3,
}: ReminderPanelProps) {
  const { canEdit } = useVehicleAccess();
  const reminders =
    visibleCount === undefined
      ? (visibleReminders ?? [])
      : (visibleReminders ?? []).slice(0, visibleCount);

  return (
    <Card className="border-line/60 bg-surface">
      <CardHeader className="border-b border-line-subtle pb-4">
        <SectionHeader
          actions={
            <>
              <Link
                className={buttonVariants({ size: 'xs', variant: 'ghost' })}
                params={{ vehicleId }}
                search={{ tab: 'reminders' }}
                to="/vehicles/$vehicleId"
              >
                View all
              </Link>
              {canEdit ? (
                <Link
                  className={buttonVariants({ size: 'xs', variant: 'outline' })}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/reminders/new"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Link>
              ) : null}
            </>
          }
          as="h3"
          description="Active service alerts."
          title={title}
        />
      </CardHeader>
      <CardContent className="pt-5 sm:p-5">
        {remindersQuery.isPending ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-page rounded-xl" />
            <div className="h-20 bg-page rounded-xl" />
          </div>
        ) : remindersQuery.isError ? (
          <EmptyState
            description="Reminders couldn't be loaded right now."
            title="Unable to load reminders"
          />
        ) : reminders.length ? (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              canEdit ? (
                <Link
                  className={buttonVariants()}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/reminders/new"
                >
                  Add first reminder
                </Link>
              ) : undefined
            }
            description="No active reminders."
            title="No reminders"
          />
        )}
      </CardContent>
    </Card>
  );
}
