import type { DashboardAttentionItem, DashboardAttentionKind, DashboardUrgency } from './dashboard';

/**
 * Where an Upcoming row falls in time. The first four are Home's attention
 * buckets, decided by the same code; `later` is everything with a date that
 * Home leaves out: due beyond 30 days, an odometer-only reminder more than
 * 1,000 km away, an EMI more than a week off (an instalment is routine until
 * its week), or a paper the user snoozed out of Home's list.
 */
export type UpcomingUrgency = DashboardUrgency | 'later';

/**
 * The page's four groups. `today` folds into `this_week`, which is how Home's
 * headline counts it ("4 things need you this week").
 */
export const UPCOMING_GROUPS = ['late', 'this_week', 'this_month', 'later'] as const;
export type UpcomingGroup = (typeof UPCOMING_GROUPS)[number];

export function upcomingGroupOf(urgency: UpcomingUrgency): UpcomingGroup {
  switch (urgency) {
    case 'overdue':
      return 'late';
    case 'today':
    case 'this_week':
      return 'this_week';
    default:
      return urgency;
  }
}

/** The page's kind filter, over the row kinds it groups. */
export const UPCOMING_KIND_FILTERS = ['reminders', 'papers', 'emis', 'other'] as const;
export type UpcomingKindFilter = (typeof UPCOMING_KIND_FILTERS)[number];

export const UPCOMING_KINDS_BY_FILTER: Record<
  UpcomingKindFilter,
  readonly DashboardAttentionKind[]
> = {
  reminders: ['reminder'],
  papers: ['document'],
  emis: ['loan_emi'],
  // The alert engine's verdicts and accessory warranties: Home shows them, so
  // Upcoming does too, or the two would disagree about what is late.
  other: ['tyre', 'service_baseline', 'accessory'],
};

/** One row of the Upcoming timeline: a Home attention row, or one Home leaves for later. */
export type UpcomingItem = Omit<DashboardAttentionItem, 'urgency'> & {
  urgency: UpcomingUrgency;
  /**
   * Papers only: the end of a live snooze. A snoozed paper that is not yet due
   * sits in `later` until then; one that has come due ignores the snooze, as on Home.
   */
  snoozedUntil?: string;
};

export type UpcomingGroupCounts = Record<UpcomingGroup, number>;

/**
 * `GET /upcoming`. `items` is one ordered list: every late, this-week and
 * this-month row (never paged, so the groups Home counts are always whole),
 * then one page of `later` rows. `counts` covers the whole filtered timeline;
 * the envelope's `meta` pages the `later` group.
 */
export type UpcomingTimeline = {
  items: UpcomingItem[];
  counts: UpcomingGroupCounts;
};
