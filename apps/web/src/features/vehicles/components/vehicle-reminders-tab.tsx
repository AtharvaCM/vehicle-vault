import { ServiceSchedulePanel } from '@/features/reminders/components/service-schedule-panel';
import { VehicleReminderList } from '@/features/reminders/components/vehicle-reminder-list';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';

type VehicleRemindersTabProps = {
  vehicleId: string;
};

/**
 * The vehicle's reminders in one place, full width as on the list page this
 * replaced (a second column leaves a reminder card's title too narrow). With
 * reminders on file they come first and the suggested schedule folds into one
 * row below; with none, the schedule is the offer under the empty state.
 */
export function VehicleRemindersTab({ vehicleId }: VehicleRemindersTabProps) {
  const remindersQuery = useVehicleReminders(vehicleId);
  const hasReminders = Boolean(remindersQuery.data?.length);

  return (
    <div className="space-y-6">
      <VehicleReminderList vehicleId={vehicleId} />
      {remindersQuery.isSuccess ? (
        <ServiceSchedulePanel collapsed={hasReminders} vehicleId={vehicleId} />
      ) : null}
    </div>
  );
}
