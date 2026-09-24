import type { Status } from '@/components/shared/status-pill';

import type { DashboardUrgency, DashboardVehicleHealth } from '../types/dashboard';

/**
 * The attention queue's buckets as statuses: overdue is late; today and this
 * week are soon; this month is coming up. Kept beside the bucket names so the
 * colour can never disagree with the group a row sits in.
 */
export const URGENCY_STATUS: Record<DashboardUrgency, Status> = {
  overdue: 'late',
  today: 'soon',
  this_week: 'soon',
  this_month: 'info',
};

/** A garage card's verdict as a status and the words that go with it. */
export function vehicleHealthStatus(
  vehicle: Pick<DashboardVehicleHealth, 'status' | 'overdueCount' | 'dueSoonCount'>,
): { status: Status; words: string } {
  if (vehicle.status === 'overdue') {
    return { status: 'late', words: `${vehicle.overdueCount} late` };
  }
  if (vehicle.status === 'due_soon') {
    return { status: 'soon', words: `${vehicle.dueSoonCount} due soon` };
  }

  return { status: 'ok', words: 'All clear' };
}
