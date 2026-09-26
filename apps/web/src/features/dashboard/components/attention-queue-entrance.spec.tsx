import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeAttentionCounts, makeAttentionItem, makeSummary } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { AttentionQueue } from './attention-queue';

// A file of its own: the entrance plays once per page load, and each spec
// file is a fresh load.

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/reminders/hooks/use-complete-reminder', () => ({
  useCompleteReminder: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));
vi.mock('../hooks/use-snooze-document', () => ({
  useSnoozeDocument: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));

const QUEUE = Array.from({ length: 9 }, (_, index) =>
  makeAttentionItem({ id: `reminder-${index}`, title: `Reminder ${index}`, urgency: 'overdue' }),
);

function renderQueue() {
  return renderWithProviders(
    <AttentionQueue
      onSearchStateChange={vi.fn()}
      queue={QUEUE}
      summary={makeSummary({
        attention: QUEUE,
        attentionTotal: QUEUE.length,
        attentionCounts: makeAttentionCounts({ overdue: QUEUE.length, total: QUEUE.length }),
      })}
    />,
  );
}

describe('AttentionQueue entrance', () => {
  it('staggers the rows in on the first mount, under half a second, motion-safe only', () => {
    const { unmount } = renderQueue();

    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-entrance]'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveClass('motion-safe:animate-attention-enter');
    const delays = rows.map((row) => parseInt(row.style.animationDelay, 10));
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBe(35);
    // Capped: the last row starts by 210 ms and runs 240 ms, so all is done under 500.
    expect(Math.max(...delays)).toBeLessThanOrEqual(210);
    unmount();
  });

  it('does not play again in the same page load', () => {
    renderQueue();

    expect(document.querySelectorAll('[data-entrance]')).toHaveLength(0);
  });
});
