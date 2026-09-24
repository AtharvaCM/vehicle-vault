import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ServiceSchedulePanel } from '@/features/reminders/components/service-schedule-panel';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';

import { ReminderPanel } from './reminder-panel';

type VehicleRemindersTabProps = {
  vehicleId: string;
  remindersQuery: ReturnType<typeof useVehicleReminders>;
  visibleReminders: ReturnType<typeof useVehicleReminders>['data'];
};

export function VehicleRemindersTab({
  vehicleId,
  remindersQuery,
  visibleReminders,
}: VehicleRemindersTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ReminderPanel
          remindersQuery={remindersQuery}
          title="Reminder queue"
          vehicleId={vehicleId}
          visibleCount={undefined}
          visibleReminders={visibleReminders}
        />
        <Card className="h-fit border-line/60 bg-surface/70">
          <CardHeader>
            <CardTitle className="text-lead font-bold">Preventative care</CardTitle>
            <CardDescription>Stay ahead of service tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-small leading-relaxed text-fg-3">
            <p>Set a due date, a due odometer, or both depending on the job.</p>
            <p>Overdue and due today reminders show up on the dashboard and reminder lists.</p>
            <p>Completed reminders stay in history for reference.</p>
          </CardContent>
        </Card>
      </div>

      <ServiceSchedulePanel vehicleId={vehicleId} />
    </div>
  );
}
