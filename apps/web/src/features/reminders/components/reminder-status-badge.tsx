import { ReminderStatus } from '@vehicle-vault/shared';

import { Badge } from '@/components/ui/badge';

import { formatReminderStatus } from '../utils/format-reminder-status';
import type { ReminderStatus as ReminderStatusType } from '../types/reminder';

type ReminderStatusBadgeProps = {
  status: ReminderStatusType;
};

export function ReminderStatusBadge({ status }: ReminderStatusBadgeProps) {
  const tone =
    status === ReminderStatus.Overdue
      ? 'danger'
      : status === ReminderStatus.DueToday
        ? 'warning'
        : status === ReminderStatus.Upcoming
          ? 'accent'
          : 'neutral';

  return <Badge tone={tone}>{formatReminderStatus(status)}</Badge>;
}
