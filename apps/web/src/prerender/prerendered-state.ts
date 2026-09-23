import type { DehydratedState } from '@tanstack/react-query';

/** The `<script type="application/json">` a prerendered page carries its query cache in. */
export const PRERENDER_STATE_ELEMENT_ID = 'vv-prerender-state';

/**
 * The query cache a prerendered page was rendered with, taken out of the
 * document so it is read once. Null on every page that was not prerendered.
 */
export function takePrerenderedState(doc: Document = document): DehydratedState | null {
  const element = doc.getElementById(PRERENDER_STATE_ELEMENT_ID);
  if (!element) return null;
  element.remove();

  try {
    const state = JSON.parse(element.textContent ?? '') as DehydratedState;
    return Array.isArray(state?.queries) ? state : null;
  } catch {
    return null;
  }
}
