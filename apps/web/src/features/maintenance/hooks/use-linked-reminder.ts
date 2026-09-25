import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { reminderDetailQueryOptions } from '@/features/reminders/api/get-reminder-by-id';

/**
 * The reminder a service is being logged for (a reminder's "Log the service
 * now", `?reminderId=`), when it is on this vehicle; null otherwise, or while
 * either is still loading. `repeat` is its own rule when it repeats: that rule,
 * not the schedule, sets the next one (#295: "the next one will be counted
 * from the service you log").
 */
export function useLinkedReminder(reminderId: string | undefined, vehicleId: string | undefined) {
  const reminderQuery = useQuery({
    ...reminderDetailQueryOptions(reminderId ?? ''),
    enabled: Boolean(reminderId),
  });
  const reminder =
    reminderQuery.data && vehicleId && reminderQuery.data.vehicleId === vehicleId
      ? reminderQuery.data
      : null;
  const repeat = useMemo(
    () =>
      reminder && (reminder.repeatEveryKm != null || reminder.repeatEveryMonths != null)
        ? { km: reminder.repeatEveryKm ?? null, months: reminder.repeatEveryMonths ?? null }
        : null,
    [reminder],
  );

  return { reminder, repeat };
}
