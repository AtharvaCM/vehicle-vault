import { ServiceSchedulePanel } from '@/features/reminders/components/service-schedule-panel';
import { VehicleReminderList } from '@/features/reminders/components/vehicle-reminder-list';

type VehicleRemindersTabProps = {
  vehicleId: string;
};

/**
 * The vehicle's reminders in one place: the suggested schedule, then every
 * reminder with its filters and bulk actions, full width as on the list page
 * this replaced (a second column leaves a reminder card's title too narrow).
 */
export function VehicleRemindersTab({ vehicleId }: VehicleRemindersTabProps) {
  return (
    <div className="space-y-6">
      <ServiceSchedulePanel vehicleId={vehicleId} />
      <VehicleReminderList vehicleId={vehicleId} />
    </div>
  );
}
