import type { DashboardFocus } from '../types/dashboard-search';
import type { DashboardAttentionItem, DashboardUrgency } from '../types/dashboard';

export const COMING_UP_LIMIT = 5;

const QUEUE_URGENCIES: readonly DashboardUrgency[] = ['overdue', 'today', 'this_week'];

export type AttentionSplit = {
  /** Items rendered inside the "Needs attention" card. */
  queue: DashboardAttentionItem[];
  /** Low-weight "Coming up" items (this_month); empty whenever a focus is active. */
  comingUp: DashboardAttentionItem[];
};

function matchesFocus(item: DashboardAttentionItem, focus: DashboardFocus | undefined) {
  switch (focus) {
    case 'overdue':
      return item.urgency === 'overdue';
    case 'week':
      return item.urgency === 'today' || item.urgency === 'this_week';
    case 'documents':
      return item.kind === 'document';
    default:
      return QUEUE_URGENCIES.includes(item.urgency);
  }
}

export function splitAttention(
  attention: DashboardAttentionItem[],
  focus?: DashboardFocus,
): AttentionSplit {
  const queue = attention.filter((item) => matchesFocus(item, focus));
  const comingUp = focus
    ? []
    : attention.filter((item) => item.urgency === 'this_month').slice(0, COMING_UP_LIMIT);

  return { queue, comingUp };
}
