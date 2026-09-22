import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { centredScrollLeft, useActiveTabInView } from './use-active-tab-in-view';

describe('centredScrollLeft', () => {
  const list = { clientWidth: 375, scrollWidth: 1200 };

  it('centres a tab in the middle of the strip', () => {
    expect(centredScrollLeft(list, { offsetLeft: 600, offsetWidth: 100 })).toBe(462.5);
  });

  it('does not scroll before the start for an early tab', () => {
    expect(centredScrollLeft(list, { offsetLeft: 40, offsetWidth: 100 })).toBe(0);
  });

  it('stops at the end for the last tab rather than overshooting', () => {
    expect(centredScrollLeft(list, { offsetLeft: 1100, offsetWidth: 100 })).toBe(825);
  });

  it('leaves a strip that fits alone', () => {
    expect(
      centredScrollLeft(
        { clientWidth: 1200, scrollWidth: 1200 },
        { offsetLeft: 900, offsetWidth: 100 },
      ),
    ).toBe(0);
  });
});

/** Tabs laid out 110 px apart in a 375 px strip, as they are on a phone. */
function layOut(list: HTMLElement) {
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: 375 });
  Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 1210 });
  list.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab, index) => {
    Object.defineProperty(tab, 'offsetLeft', { configurable: true, value: index * 110 });
    Object.defineProperty(tab, 'offsetWidth', { configurable: true, value: 100 });
  });
}

function TabStrip({ active, ready = true }: { active: string; ready?: boolean }) {
  const ref = useActiveTabInView(active);
  const tabs = Array.from({ length: 11 }, (_, index) => `tab-${index}`);

  // `ready` stands in for the vehicle page, whose tabs mount once data loads.
  if (!ready) return <p>Loading</p>;

  return (
    <div
      data-testid="strip"
      ref={(node) => {
        if (node) layOut(node);
        ref(node);
      }}
    >
      {tabs.map((tab) => (
        <button data-state={tab === active ? 'active' : 'inactive'} key={tab} role="tab">
          {tab}
        </button>
      ))}
    </div>
  );
}

describe('useActiveTabInView', () => {
  it('brings a tab linked to directly into view on load', () => {
    const { getByTestId } = render(<TabStrip active="tab-9" />);

    // tab-9 sits at 990; centred in 375 that is 990 - 137.5 = 852.5, capped at 835.
    expect(getByTestId('strip').scrollLeft).toBe(835);
  });

  it('follows the selection as it changes', () => {
    const { getByTestId, rerender } = render(<TabStrip active="tab-9" />);

    rerender(<TabStrip active="tab-4" />);

    expect(getByTestId('strip').scrollLeft).toBe(302.5);
  });

  it('catches a strip that only mounts once its data has loaded', () => {
    const { getByTestId, rerender } = render(<TabStrip active="tab-9" ready={false} />);

    rerender(<TabStrip active="tab-9" ready />);

    expect(getByTestId('strip').scrollLeft).toBe(835);
  });
});
