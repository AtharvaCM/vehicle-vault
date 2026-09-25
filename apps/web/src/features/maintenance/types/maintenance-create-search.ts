import type { MaintenanceCategory } from '@vehicle-vault/shared';

import { parseCategorySlug } from '../utils/service-work';

/**
 * The new-record route's address, `/vehicles/:id/maintenance/new?category=<slug>&reminderId=<id>`:
 * a contract other flows link to (a reminder's Done → Log service, #295).
 * `category` is a maintenance category as the API names it (`engine_oil`) and
 * preselects it; `reminderId` names the reminder the service is logged for.
 * Anything else, or a value that is not one of those, is dropped.
 */
export type MaintenanceCreateSearch = {
  category?: MaintenanceCategory;
  reminderId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeMaintenanceCreateSearch(
  search: Record<string, unknown>,
): MaintenanceCreateSearch {
  const category = parseCategorySlug(search.category);
  const reminderId =
    typeof search.reminderId === 'string' && UUID.test(search.reminderId)
      ? search.reminderId
      : undefined;

  return {
    ...(category ? { category } : {}),
    ...(reminderId ? { reminderId } : {}),
  };
}

/**
 * The draft confirm page's address, `/maintenance-records/:id/edit?reminderId=<id>`:
 * a bill snapped from a reminder's "Log the service now" opens its draft here,
 * and confirming it completes that reminder. Anything else is dropped.
 */
export type MaintenanceEditSearch = {
  reminderId?: string;
};

export function normalizeMaintenanceEditSearch(
  search: Record<string, unknown>,
): MaintenanceEditSearch {
  const { reminderId } = normalizeMaintenanceCreateSearch({ reminderId: search.reminderId });

  return reminderId ? { reminderId } : {};
}
