import type { DashboardFocus } from '../types/dashboard-search';
import type {
  DashboardAttentionItem,
  DashboardSummary,
  DashboardUrgency,
} from '../types/dashboard';

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

/**
 * Nothing is tracked at all yet: no reminders, no insurance on any vehicle and
 * nothing due. Home then asks for papers or a reminder rather than calling a
 * garage it knows nothing about "All clear".
 */
export function isNothingTracked(
  summary: Pick<DashboardSummary, 'attentionCounts' | 'vehicles' | 'reminderCounts'>,
  queue: DashboardAttentionItem[],
) {
  return (
    queue.length === 0 &&
    summary.attentionCounts.total === 0 &&
    summary.vehicles.every((vehicle) => vehicle.documents.insurance?.state === 'missing') &&
    Object.values(summary.reminderCounts).every((count) => count === 0)
  );
}
