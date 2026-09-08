/**
 * How a **Reminder** remembers which service-schedule catalog item produced it.
 *
 * `Reminder` has no column for it, and adding one would be the honest fix — but
 * the marker predates this file and is already written into live rows, so it is
 * parsed rather than migrated. Kept in its own module because two consumers now
 * read it: **ServiceScheduleService**, which uses it to avoid suggesting a
 * reminder that already exists and to roll a completed one forward, and the
 * **AlertEngine**, which uses it to stay quiet about a reminder whose subject is
 * already alerted on from measurements.
 *
 * Pure functions on purpose: the alert engine can import them without the
 * notifications module taking a dependency on the reminders module, which would
 * close a cycle (reminders → notifications → tyres).
 */
const SLUG_MARKER = '[catalog:';

/** The slug of the tyre walk-around item, named here because the alert engine matches on it. */
export const TYRE_INSPECTION_SLUG = 'tyre_inspection';

export function composeCatalogNotes(slug: string, notes?: string): string {
  const marker = `${SLUG_MARKER}${slug}]`;
  return notes ? `${notes}\n${marker}` : marker;
}

export function extractSlugFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const idx = notes.indexOf(SLUG_MARKER);
  if (idx === -1) return null;
  const end = notes.indexOf(']', idx);
  if (end === -1) return null;
  return notes.slice(idx + SLUG_MARKER.length, end);
}
