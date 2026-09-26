import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** How far a row travels before letting go runs its action. */
export const SWIPE_THRESHOLD = 80;
/** How far a finger moves before the gesture is read as a swipe or a scroll. */
const LOCK_DISTANCE = 10;
/** The furthest a row follows the finger. */
const MAX_TRAVEL = 120;

export type SwipeAction = {
  /** Said on the strip the row uncovers, and to assistive technology. */
  label: string;
  run: () => void;
};

type SwipeRowProps = {
  /** Swiping right (the finger moves right): the row's primary verb. */
  right?: SwipeAction;
  /** Swiping left: usually Snooze. */
  left?: SwipeAction;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

type Gesture = { id: number; x: number; y: number; axis: 'x' | 'y' | null };

/**
 * A row a finger can swipe: right for its primary verb, left for the other,
 * each shown on the strip the row uncovers as it slides. Touch only; a mouse
 * or pen uses the row's buttons, which stay where they are. A gesture that
 * starts mostly vertical is left to the page's scroll (`touch-action: pan-y`),
 * and letting go short of the threshold puts the row back.
 */
export function SwipeRow({ right, left, disabled = false, className, children }: SwipeRowProps) {
  const gesture = useRef<Gesture | null>(null);
  // A swipe ends with the finger lifting over a link: that click must not follow it.
  const swallowClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const enabled = !disabled && Boolean(right || left);

  function reset() {
    gesture.current = null;
    setOffset(0);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType !== 'touch' || !event.isPrimary) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.id) return;

    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;

    if (current.axis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_DISTANCE) return;
      current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (current.axis !== 'x') return;

    // Only towards a side that has an action.
    const allowed = dx > 0 ? (right ? dx : 0) : left ? dx : 0;
    setOffset(Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, allowed)));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.id) return;

    if (current.axis === 'x') {
      swallowClick.current = Math.abs(offset) > LOCK_DISTANCE;
      if (offset >= SWIPE_THRESHOLD) right?.run();
      else if (offset <= -SWIPE_THRESHOLD) left?.run();
    }
    reset();
  }

  const uncovered = offset > 0 ? right : offset < 0 ? left : undefined;
  const armed = Math.abs(offset) >= SWIPE_THRESHOLD;

  return (
    <div className={cn('relative overflow-hidden', className)} data-slot="swipe-row">
      {uncovered ? (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center px-5 text-ui font-semibold transition-colors',
            offset > 0 ? 'justify-start' : 'justify-end',
            armed ? 'bg-brand text-on-brand' : 'bg-page text-fg-2',
          )}
          data-testid="swipe-strip"
        >
          {uncovered.label}
        </div>
      ) : null}
      <div
        className={cn(
          'relative bg-surface',
          offset === 0 && 'transition-transform',
          enabled && 'touch-pan-y',
        )}
        onClickCapture={(event) => {
          if (swallowClick.current) {
            swallowClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onPointerCancel={reset}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={offset !== 0 ? { transform: `translateX(${offset}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
