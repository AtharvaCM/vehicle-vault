/**
 * Whole days from `today` until a warranty expiry, negative once it is past.
 *
 * The expiry arrives as a UTC-midnight instant while "today" is the viewer's
 * calendar day, so both sides are reduced to a UTC day number before being
 * compared. Subtracting a local-midnight timestamp from the instant directly
 * puts every result a day out east of Greenwich — in IST that made a warranty
 * which ended yesterday still read as current.
 *
 * `today` is passed in rather than read from the clock so the arithmetic is
 * testable without depending on the runner's timezone.
 */
export function daysUntilExpiry(expiryIso: string, today: Date): number {
  const todayUtcDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const expiry = new Date(expiryIso);
  const expiryUtcDay = Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate(),
  );

  return Math.round((expiryUtcDay - todayUtcDay) / (24 * 60 * 60 * 1000));
}
