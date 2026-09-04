import type { DashboardSummary } from '../types/dashboard';
import { formatRelativeDue } from './format-due';

type HeadlineInput = Pick<DashboardSummary, 'attention' | 'attentionCounts'>;

/** The page description under the "Dashboard" H1. */
export function dashboardHeadline({ attention, attentionCounts }: HeadlineInput) {
  const urgentCount = attentionCounts.overdue + attentionCounts.today + attentionCounts.thisWeek;

  if (urgentCount > 0) {
    const headline =
      urgentCount === 1
        ? '1 thing needs your attention.'
        : `${urgentCount} things need your attention.`;

    return attentionCounts.urgentVehicles > 1
      ? `${headline} Across ${attentionCounts.urgentVehicles} vehicles.`
      : headline;
  }

  const next = attention.find((item) => item.urgency === 'this_month');

  if (next) {
    return `Nothing due right now. Next up: ${next.title} · ${formatRelativeDue(next)}.`;
  }

  return 'Nothing due in the next 30 days.';
}
