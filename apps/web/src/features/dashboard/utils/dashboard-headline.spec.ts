import { describe, expect, it } from 'vitest';

import { makeAttentionCounts, makeAttentionItem } from '../test/fixtures';
import { dashboardHeadline } from './dashboard-headline';

describe('dashboardHeadline', () => {
  it('counts urgent items and mentions vehicles when more than one is involved', () => {
    expect(
      dashboardHeadline({
        attention: [
          makeAttentionItem({ id: 'a', urgency: 'overdue', vehicleId: 'v1' }),
          makeAttentionItem({ id: 'b', urgency: 'today', vehicleId: 'v2' }),
          makeAttentionItem({ id: 'c', urgency: 'this_month', vehicleId: 'v3' }),
        ],
        attentionCounts: makeAttentionCounts({ overdue: 1, today: 1, thisMonth: 1, total: 3 }),
      }),
    ).toBe('2 things need your attention. Across 2 vehicles.');
  });

  it('omits the vehicle count when the capped list cannot cover every urgent item', () => {
    expect(
      dashboardHeadline({
        attention: [
          makeAttentionItem({ id: 'a', urgency: 'overdue', vehicleId: 'v1' }),
          makeAttentionItem({ id: 'b', urgency: 'overdue', vehicleId: 'v2' }),
        ],
        attentionCounts: makeAttentionCounts({ overdue: 30, total: 30 }),
      }),
    ).toBe('30 things need your attention.');
  });

  it('uses singular wording and omits the vehicle count for a single vehicle', () => {
    expect(
      dashboardHeadline({
        attention: [makeAttentionItem({ urgency: 'this_week' })],
        attentionCounts: makeAttentionCounts({ thisWeek: 1, total: 1 }),
      }),
    ).toBe('1 thing needs your attention.');
  });

  it('points at the next coming-up item when nothing is urgent', () => {
    expect(
      dashboardHeadline({
        attention: [
          makeAttentionItem({
            kind: 'document',
            title: 'Insurance policy',
            urgency: 'this_month',
            daysUntilDue: 12,
          }),
        ],
        attentionCounts: makeAttentionCounts({ thisMonth: 1, total: 1 }),
      }),
    ).toBe('Nothing due right now. Next up: Insurance policy · Expires in 12 days.');
  });

  it('reports an empty month', () => {
    expect(dashboardHeadline({ attention: [], attentionCounts: makeAttentionCounts() })).toBe(
      'Nothing due in the next 30 days.',
    );
  });
});
