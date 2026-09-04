export const dashboardFocusOptions = ['overdue', 'week', 'documents'] as const;

export type DashboardFocus = (typeof dashboardFocusOptions)[number];

export type DashboardSearch = {
  focus?: DashboardFocus;
};

export function isDashboardFocus(value: unknown): value is DashboardFocus {
  return typeof value === 'string' && (dashboardFocusOptions as readonly string[]).includes(value);
}

/** Never throws: anything that is not a known focus collapses to `{}`. */
export function normalizeDashboardSearch(search: Record<string, unknown>): DashboardSearch {
  const focus =
    search !== null && typeof search === 'object' && isDashboardFocus(search.focus)
      ? search.focus
      : undefined;

  return focus ? { focus } : {};
}
