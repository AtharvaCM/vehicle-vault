import type { DehydratedState } from '@tanstack/react-query';

/** The `<script type="application/json">` a prerendered page carries its query cache in. */
export const PRERENDER_STATE_ELEMENT_ID = 'vv-prerender-state';

/**
 * The query cache a prerendered page was rendered with, taken out of the
 * document so it is read once. Null on every page that was not prerendered.
 *
 * The data is dated to now rather than to the build. The catalog changes only
 * with a deploy, so a page's own data is as fresh as the page; dated to the
 * build, a page deployed more than an hour ago would be stale on arrival and
 * refetch from the API on every visit.
 */
export function takePrerenderedState(
  doc: Document = document,
  now: number = Date.now(),
): DehydratedState | null {
  const element = doc.getElementById(PRERENDER_STATE_ELEMENT_ID);
  if (!element) return null;
  element.remove();

  let state: DehydratedState;
  try {
    state = JSON.parse(element.textContent ?? '') as DehydratedState;
  } catch {
    return null;
  }
  if (!Array.isArray(state?.queries)) return null;

  return {
    ...state,
    queries: state.queries.map((query) => ({
      ...query,
      state: { ...query.state, dataUpdatedAt: now },
    })),
  };
}
