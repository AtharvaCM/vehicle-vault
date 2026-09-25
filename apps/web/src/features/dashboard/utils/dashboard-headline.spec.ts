import { describe, expect, it } from 'vitest';

import { makeAttentionCounts, makeAttentionItem } from '../test/fixtures';
import { dashboardHeadline } from './dashboard-headline';

describe('dashboardHeadline', () => {
  it('counts what is late and due this week, across the vehicles involved', () => {
    expect(
      dashboardHeadline({
        attention: [],
        attentionCounts: makeAttentionCounts({
          overdue: 1,
          today: 1,
          thisWeek: 3,
          urgentVehicles: 3,
          total: 5,
        }),
      }),
    ).toEqual({ status: 'late', text: '1 late · 4 this week · across 3 vehicles' });
  });

  it('trusts attentionCounts.urgentVehicles over the capped item list', () => {
    expect(
      dashboardHeadline({
        attention: [
          makeAttentionItem({ id: 'a', urgency: 'overdue', vehicleId: 'v1' }),
          makeAttentionItem({ id: 'b', urgency: 'overdue', vehicleId: 'v1' }),
        ],
        attentionCounts: makeAttentionCounts({ overdue: 30, urgentVehicles: 15, total: 30 }),
      }).text,
    ).toBe('30 late · across 15 vehicles');
  });

  it('leaves out the vehicle count for one vehicle, and reads "soon" with nothing late', () => {
    expect(
      dashboardHeadline({
        attention: [makeAttentionItem({ urgency: 'this_week' })],
        attentionCounts: makeAttentionCounts({ thisWeek: 1, urgentVehicles: 1, total: 1 }),
      }),
    ).toEqual({ status: 'soon', text: '1 this week' });
  });

  it('is "All clear", naming what comes next', () => {
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
    ).toEqual({ status: 'ok', text: 'All clear · Next: Insurance policy · 12 days left' });
  });

  it('is plain "All clear" when nothing is due in 30 days', () => {
    expect(dashboardHeadline({ attention: [], attentionCounts: makeAttentionCounts() })).toEqual({
      status: 'ok',
      text: 'All clear',
    });
  });
});
