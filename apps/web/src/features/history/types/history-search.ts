import { HISTORY_KINDS, HISTORY_SEARCH_MAX_LENGTH, type HistoryKind } from '@vehicle-vault/shared';

/** The History page's filters, kept in the URL so Back and shared links keep them. */
export type HistorySearch = {
  vehicle?: string;
  kind?: HistoryKind;
  /** Words to find, as typed. See `HistoryQuerySchema.search`. */
  search?: string;
};

/** A search as the URL keeps it: trimmed, capped, and absent when blank. */
export function normalizeHistorySearchText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, HISTORY_SEARCH_MAX_LENGTH);
  return text || undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Anything else in the query is dropped, including the old maintenance list's
 * `category` and `sort`, which `/maintenance` links still carry. Its `search`
 * means the same here, so it is kept.
 */
export function normalizeHistorySearch(search: Record<string, unknown>): HistorySearch {
  const vehicle =
    typeof search.vehicle === 'string' && UUID.test(search.vehicle) ? search.vehicle : undefined;
  const kind =
    typeof search.kind === 'string' && (HISTORY_KINDS as readonly string[]).includes(search.kind)
      ? (search.kind as HistoryKind)
      : undefined;

  const text = normalizeHistorySearchText(search.search);

  return {
    ...(vehicle ? { vehicle } : {}),
    ...(kind ? { kind } : {}),
    ...(text ? { search: text } : {}),
  };
}
