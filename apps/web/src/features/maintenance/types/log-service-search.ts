import { MaintenanceCategory } from '@vehicle-vault/shared';

/**
 * What the new-record route (`/vehicles/$vehicleId/maintenance/new`) accepts
 * in its URL: a category to preselect, and the reminder the service answers.
 * A reminder's "Log the service now" sends both; the form sends `reminderId`
 * with the record, and the API completes that reminder when the record saves.
 */
export type LogServiceSearch = {
  category?: MaintenanceCategory;
  reminderId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set<string>(Object.values(MaintenanceCategory));

/** Never throws: an unknown category or a malformed id is dropped, not an error page. */
export function normalizeLogServiceSearch(search: Record<string, unknown>): LogServiceSearch {
  const category =
    typeof search.category === 'string' && CATEGORIES.has(search.category)
      ? (search.category as MaintenanceCategory)
      : undefined;
  const reminderId =
    typeof search.reminderId === 'string' && UUID_PATTERN.test(search.reminderId)
      ? search.reminderId
      : undefined;

  return {
    ...(category ? { category } : {}),
    ...(reminderId ? { reminderId } : {}),
  };
}
