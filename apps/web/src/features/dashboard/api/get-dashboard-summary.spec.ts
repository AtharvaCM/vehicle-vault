import { describe, expect, it } from 'vitest';

import { makeSummary } from '../test/fixtures';
import { normalizeDashboardSummary } from './get-dashboard-summary';

describe('normalizeDashboardSummary', () => {
  it('passes a complete payload through untouched', () => {
    const summary = makeSummary({ hasSpend: true });

    expect(normalizeDashboardSummary(summary)).toEqual(summary);
  });

  it('defaults the rollup fields when an older API omits them', () => {
    const {
      attention: _attention,
      attentionTotal: _attentionTotal,
      attentionCounts: _attentionCounts,
      vehicles: _vehicles,
      vehiclesTotal: _vehiclesTotal,
      hasSpend: _hasSpend,
      ...legacy
    } = makeSummary({ totalVehicles: 2, totalMaintenanceRecords: 3 });

    const result = normalizeDashboardSummary(legacy);

    expect(result.attention).toEqual([]);
    expect(result.attentionTotal).toBe(0);
    expect(result.attentionCounts.total).toBe(0);
    expect(result.vehicles).toEqual([]);
    expect(result.vehiclesTotal).toBe(2);
    expect(result.hasSpend).toBe(true);
  });
});
