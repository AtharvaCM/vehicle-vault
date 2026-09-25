import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SwipeRow } from './swipe-row';

function swipe(target: Element, dx: number, dy = 0, pointerType = 'touch') {
  const base = { pointerId: 1, isPrimary: true, pointerType };
  fireEvent.pointerDown(target, { ...base, clientX: 100, clientY: 100 });
  // Past the lock distance first, then to the end point.
  fireEvent.pointerMove(target, {
    ...base,
    clientX: 100 + Math.sign(dx) * 12,
    clientY: 100 + Math.sign(dy) * 12,
  });
  fireEvent.pointerMove(target, { ...base, clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(target, { ...base, clientX: 100 + dx, clientY: 100 + dy });
}

function show() {
  const done = vi.fn();
  const snooze = vi.fn();
  const clicked = vi.fn();
  render(
    <SwipeRow left={{ label: 'Snooze', run: snooze }} right={{ label: 'Done', run: done }}>
      <button onClick={clicked} type="button">
        row
      </button>
    </SwipeRow>,
  );
  return { done, snooze, clicked, row: screen.getByRole('button', { name: 'row' }) };
}

describe('SwipeRow', () => {
  it('runs the right action past the threshold, and the left one the other way', () => {
    const { done, snooze, row } = show();

    swipe(row, 120);
    expect(done).toHaveBeenCalledTimes(1);

    swipe(row, -120);
    expect(snooze).toHaveBeenCalledTimes(1);
  });

  it('puts the row back when let go short of the threshold', () => {
    const { done, snooze, row } = show();

    swipe(row, 40);
    expect(done).not.toHaveBeenCalled();
    expect(snooze).not.toHaveBeenCalled();
  });

  it('leaves a mostly vertical gesture to the page scroll', () => {
    const { done, row } = show();

    swipe(row, 90, 200);
    expect(done).not.toHaveBeenCalled();
  });

  it('ignores a mouse, which uses the buttons instead', () => {
    const { done, row } = show();

    swipe(row, 120, 0, 'mouse');
    expect(done).not.toHaveBeenCalled();
  });

  it('does not let the click that ends a swipe through', () => {
    const { clicked, row } = show();

    swipe(row, 120);
    fireEvent.click(row);
    expect(clicked).not.toHaveBeenCalled();

    fireEvent.click(row);
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
