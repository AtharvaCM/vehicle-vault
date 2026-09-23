import type { DashboardAttentionCounts } from '../types/dashboard';

/**
 * How many things need attention: overdue, due today, or due within 7 days.
 * The headline, the "vehicles needing attention" tile, the garage cards and
 * the bell all read this one set; items 8–30 days out are "coming up".
 */
export function attentionCount(counts: DashboardAttentionCounts): number {
  return counts.overdue + counts.today + counts.thisWeek;
}
