import type { HistoryEntry, HistoryPage } from '@vehicle-vault/shared';

export type HistoryMonthGroup = {
  /** `2026-09`: a month on the Indian calendar, as the API buckets it. */
  month: string;
  /** Confirmed service and fuel spend in the whole month; null when there is none to count. */
  total: number | null;
  draftCount: number;
  entries: HistoryEntry[];
};

/**
 * The loaded pages as month groups, newest first. A month can run across two
 * pages; its entries join one group, and its total is the API's figure for the
 * whole month either way, so loading more never changes a header already shown.
 */
export function groupHistory(pages: HistoryPage[]): HistoryMonthGroup[] {
  const totals = new Map(pages.flatMap((page) => page.months).map((m) => [m.month, m]));
  const groups: HistoryMonthGroup[] = [];

  for (const entry of pages.flatMap((page) => page.entries)) {
    let group = groups.at(-1);

    if (group?.month !== entry.month) {
      const summary = totals.get(entry.month);
      group = {
        month: entry.month,
        total: summary?.total != null ? Number(summary.total) : null,
        draftCount: summary?.draftCount ?? 0,
        entries: [],
      };
      groups.push(group);
    }

    group.entries.push(entry);
  }

  return groups;
}

/** The first day of a month key, as a date `format.date` can name. */
export function monthStart(month: string) {
  return `${month}-01T00:00:00.000Z`;
}
