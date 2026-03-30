import { MaintenanceLineItemKind } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  getMaintenanceLineItemBreakdown,
  isMeaningfulMaintenanceLineItem,
  resolveMaintenanceLineItemTotal,
} from './get-maintenance-line-item-breakdown';

describe('getMaintenanceLineItemBreakdown', () => {
  it('derives totals and category splits from maintenance line items', () => {
    const breakdown = getMaintenanceLineItemBreakdown([
      { kind: MaintenanceLineItemKind.Part, name: 'Oil filter', lineTotal: 450 },
      {
        kind: MaintenanceLineItemKind.Fluid,
        name: 'Engine oil',
        quantity: 3.5,
        unitPrice: 400,
      },
      { kind: MaintenanceLineItemKind.Labor, name: 'Labor', lineTotal: 600 },
      { kind: MaintenanceLineItemKind.Tax, name: 'GST', lineTotal: 225 },
      { kind: MaintenanceLineItemKind.Discount, name: 'Discount', lineTotal: 100 },
      { kind: MaintenanceLineItemKind.Job, name: 'Periodic inspection', lineTotal: 250 },
    ]);

    expect(breakdown).toEqual({
      totalCost: 2825,
      laborCost: 600,
      partsCost: 450,
      fluidsCost: 1400,
      taxCost: 225,
      discountAmount: 100,
    });
  });

  it('treats blank rows as not meaningful and unresolved totals as zero', () => {
    expect(
      isMeaningfulMaintenanceLineItem({ kind: MaintenanceLineItemKind.Job, name: '   ' }),
    ).toBe(false);
    expect(
      resolveMaintenanceLineItemTotal({ kind: MaintenanceLineItemKind.Job, name: 'Checkup' }),
    ).toBe(0);
  });
});
