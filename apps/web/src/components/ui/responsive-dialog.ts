import { useEffect, useState } from 'react';

/**
 * Below `md` every dialog presents as a bottom sheet: full width, resting on
 * the bottom, scrolling within itself. Shared by `Dialog` and `AlertDialog`, so
 * no dialog has to opt in.
 *
 * It is a layer of `max-md:` overrides on top of the centred modal's own
 * classes, which stay exactly as they were. That keeps `md` and up unchanged,
 * including the width and height overrides individual dialogs pass
 * (`max-w-2xl`, `sm:max-w-[600px]`, `max-h-[90vh]`): below `md` these rules
 * sit in a media query and win, and from `md` they do not exist.
 *
 * The sheet rests on `--keyboard-inset` (0 until an on-screen keyboard opens)
 * and is capped at `--visible-height`, the screen the keyboard leaves; see
 * `useVisibleViewport`. The bottom padding clears the iOS home indicator.
 */
export const sheetBelowMdContentClass = [
  'max-md:inset-x-0 max-md:mx-auto max-md:top-auto max-md:bottom-(--keyboard-inset,0px)',
  'max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0',
  'max-md:max-h-[calc(var(--visible-height,100dvh)-1.5rem)] max-md:overscroll-contain',
  'max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0',
  'max-md:pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
].join(' ');

/**
 * Below `md` the footer holding the primary action stays pinned to the bottom
 * of the sheet while the form above it scrolls, so Save is in reach while
 * typing. It spans the sheet's full width and carries the home-indicator
 * clearance itself.
 *
 * A sticky element pins inside its scroller's padding, so `bottom: 0` would
 * leave the sheet's bottom padding as a strip under the footer with the form
 * scrolling through it. The negative offset pins it flush with the sheet's edge
 * instead, and the matching negative margin keeps it flush at the end of the
 * scroll too.
 */
export const sheetBelowMdFooterClass = [
  'max-md:sticky max-md:bottom-[calc(-1.25rem-env(safe-area-inset-bottom))] max-md:z-10',
  'max-md:-mx-5 max-md:border-t max-md:bg-background',
  'max-md:mb-[calc(-1.25rem-env(safe-area-inset-bottom))]',
  'max-md:px-5 max-md:pt-3 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
].join(' ');

type VisibleViewport = { keyboardInset: number; visibleHeight: number };

/**
 * The height of the screen left above an on-screen keyboard, and how far the
 * keyboard reaches up. `window.innerHeight` keeps the full layout height while
 * the keyboard is open (iOS Safari, and Chrome's default resize mode); it is
 * the visual viewport that shrinks.
 */
export function measureVisibleViewport(
  innerHeight: number,
  viewport: { height: number; offsetTop: number },
): VisibleViewport {
  return {
    keyboardInset: Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop)),
    visibleHeight: Math.round(viewport.height),
  };
}

/**
 * Keeps `--keyboard-inset` and `--visible-height` current on the element it is
 * given while that element is mounted. Written straight to its style rather
 * than through state, so a keyboard animating open does not re-render the
 * dialog on every frame. Without a visual viewport (older browsers, jsdom) the
 * CSS fallbacks apply. Returns a callback ref.
 */
export function useVisibleViewport() {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!node || !viewport) return;

    const update = () => {
      const { keyboardInset, visibleHeight } = measureVisibleViewport(window.innerHeight, viewport);
      node.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
      node.style.setProperty('--visible-height', `${visibleHeight}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [node]);

  return setNode;
}
