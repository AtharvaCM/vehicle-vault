/**
 * Wording shared by the two reminder templates, so a date reminder and its
 * overdue twin cannot drift apart.
 */

/**
 * Formatted in UTC rather than Asia/Kolkata, unlike the document and accessory
 * templates. A reminder's due day is a UTC calendar day everywhere else in the
 * app — `RemindersService.getDueDateStatus` and the dashboard attention queue
 * both count it that way — and shifting the zone here would print a date that
 * contradicts the "in 3 days" standing next to it.
 */
export function formatDueDate(dueDate: Date): string {
  return dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });
}

/** "1 day" / "6 days", sign-agnostic: the caller's sentence says which way it runs. */
export function formatDayCount(days: number): string {
  const whole = Math.abs(Math.round(days));
  return `${whole} day${whole === 1 ? '' : 's'}`;
}
