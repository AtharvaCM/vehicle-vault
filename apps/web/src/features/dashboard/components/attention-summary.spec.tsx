import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeAttentionCounts, makeSummary, makeVehicle } from '../test/fixtures';
import { dashboardHeadline } from '../utils/dashboard-headline';
import { AttentionSummary } from './attention-summary';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { search?: unknown; to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('AttentionSummary garage tile', () => {
  it('counts the same vehicles as the headline, leaving out what is only coming up', () => {
    // The demo garage: 5 items within 7 days across 3 vehicles, and a fourth
    // vehicle with something 20 days out.
    const summary = makeSummary({
      vehicles: ['a', 'b', 'c', 'd'].map((id) => makeVehicle({ id })),
      attentionCounts: makeAttentionCounts({
        overdue: 1,
        today: 1,
        thisWeek: 3,
        thisMonth: 1,
        urgentVehicles: 3,
        vehiclesNeedingAttention: 3,
        total: 6,
      }),
    });

    render(<AttentionSummary summary={summary} />);

    expect(dashboardHeadline(summary)).toBe('5 things need your attention. Across 3 vehicles.');
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
    expect(screen.getByText('Something overdue or due within 7 days')).toBeInTheDocument();
  });

  it('reads the headline’s count even from an API that counted 30-day items', () => {
    const summary = makeSummary({
      vehicles: ['a', 'b', 'c', 'd'].map((id) => makeVehicle({ id })),
      attentionCounts: makeAttentionCounts({
        thisWeek: 1,
        thisMonth: 3,
        urgentVehicles: 1,
        vehiclesNeedingAttention: 4,
        total: 4,
      }),
    });

    render(<AttentionSummary summary={summary} />);

    expect(screen.getByText('1 of 4')).toBeInTheDocument();
  });
});
