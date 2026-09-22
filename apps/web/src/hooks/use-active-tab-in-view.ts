import { useCallback, useLayoutEffect, useState } from 'react';

type ScrollBox = { clientWidth: number; scrollWidth: number };
type TabBox = { offsetLeft: number; offsetWidth: number };

/**
 * The `scrollLeft` that centres `tab` in `list`, clamped to what the list can
 * actually scroll. `offsetLeft` is measured from the list, so the list must be
 * the tab's offset parent (give it `position: relative`).
 */
export function centredScrollLeft(list: ScrollBox, tab: TabBox): number {
  const centred = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
  const furthest = Math.max(0, list.scrollWidth - list.clientWidth);

  return Math.min(Math.max(0, centred), furthest);
}

/**
 * Keeps the selected tab in view in a tab list that scrolls sideways. On a
 * phone the strip is wider than the screen, and a link straight to a later tab
 * would otherwise open with that tab scrolled out of sight.
 *
 * It scrolls the list, never the page: `scrollIntoView` would also move the
 * window to reveal the strip, which on a phone sits below the fold. Returns a
 * callback ref, so a list that mounts late (after its data loads) is still
 * caught.
 */
export function useActiveTabInView(activeValue: string) {
  const [list, setList] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const tab = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!list || !tab) return;

    list.scrollLeft = centredScrollLeft(list, tab);
  }, [list, activeValue]);

  return useCallback((node: HTMLElement | null) => setList(node), []);
}
