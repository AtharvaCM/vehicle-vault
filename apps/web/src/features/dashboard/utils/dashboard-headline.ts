import type { Status } from '@/components/shared/status-pill';

import type { DashboardSummary } from '../types/dashboard';
import { formatRelativeDue } from './format-due';

type HeadlineInput = Pick<DashboardSummary, 'attention' | 'attentionCounts'>;

export type Headline = { status: Status; text: string };

/**
 * Home's status line under the H1: "1 late · 4 this week · across 3 vehicles",
 * or "All clear" with what comes next. It reads the same counts as the attention
 * queue and Upcoming, so the three never disagree.
 */
export function dashboardHeadline({ attention, attentionCounts }: HeadlineInput): Headline {
  const late = attentionCounts.overdue;
  const thisWeek = attentionCounts.today + attentionCounts.thisWeek;

  if (late + thisWeek > 0) {
    const parts = [
      ...(late > 0 ? [`${late} late`] : []),
      ...(thisWeek > 0 ? [`${thisWeek} this week`] : []),
      // The API's own count: the capped item list cannot cover every urgent vehicle.
      ...(attentionCounts.urgentVehicles > 1
        ? [`across ${attentionCounts.urgentVehicles} vehicles`]
        : []),
    ];

    return { status: late > 0 ? 'late' : 'soon', text: parts.join(' · ') };
  }

  const next = attention.find((item) => item.urgency === 'this_month');

  return {
    status: 'ok',
    text: next ? `All clear · Next: ${next.title} · ${formatRelativeDue(next)}` : 'All clear',
  };
}
