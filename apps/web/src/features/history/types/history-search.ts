import { HISTORY_KINDS, type HistoryKind } from '@vehicle-vault/shared';

/** The History page's filters, kept in the URL so Back and shared links keep them. */
export type HistorySearch = {
  vehicle?: string;
  kind?: HistoryKind;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Anything else in the query is dropped, including the old maintenance list's
 * `search`, `category` and `sort`, which `/maintenance` links still carry.
 */
export function normalizeHistorySearch(search: Record<string, unknown>): HistorySearch {
  const vehicle =
    typeof search.vehicle === 'string' && UUID.test(search.vehicle) ? search.vehicle : undefined;
  const kind =
    typeof search.kind === 'string' && (HISTORY_KINDS as readonly string[]).includes(search.kind)
      ? (search.kind as HistoryKind)
      : undefined;

  return {
    ...(vehicle ? { vehicle } : {}),
    ...(kind ? { kind } : {}),
  };
}
