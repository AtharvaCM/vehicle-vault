/**
 * `Notification.title` is VARCHAR(120), and several templates prefix fixed
 * wording onto a user-supplied name that may itself fill 120 characters — a
 * reminder title, a compliance document's provider, an accessory name. The
 * insert in `NotifyService.raise` then throws, and because
 * `MaintenanceAlertService.runDailyChecks` catches per vehicle rather than per
 * alert, one oversized title costs that vehicle every remaining alert in the
 * run. Templates build prefixed titles through here so the column can't be
 * overflowed by data a user typed.
 */
export const NOTIFICATION_TITLE_MAX_LENGTH = 120;

/** Clip to `max` characters, spending the last one on an ellipsis when cut. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * `prefix + subject`, clipped to the title column. Only the subject is trimmed:
 * the fixed wording is what tells the reader which kind of alert this is, so it
 * always survives whole.
 */
export function prefixedTitle(prefix: string, subject: string): string {
  return `${prefix}${truncate(subject, NOTIFICATION_TITLE_MAX_LENGTH - prefix.length)}`;
}
