import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  createSuggestedMaintenanceImportMapping,
  parseMaintenanceImportRows,
} from './parse-maintenance-import';

describe('parseMaintenanceImportRows', () => {
  it('groups multiple CSV rows into one maintenance record and builds line items', () => {
    const preview = parseMaintenanceImportRows(
      [
        {
          date: '2026-03-01',
          odometer: '12000',
          invoice: 'INV-1',
          workshop: 'Torque Garage',
          item: 'Engine oil',
          item_category: 'engine oil',
          qty: '3.5',
          rate: '400',
          amount: '1400',
        },
        {
          date: '2026-03-01',
          odometer: '12000',
          invoice: 'INV-1',
          workshop: 'Torque Garage',
          item: 'Oil filter',
          item_kind: 'part',
          item_category: 'oil filter',
          qty: '1',
          amount: '450',
        },
      ],
      {
        serviceDate: 'date',
        odometer: 'odometer',
        invoiceNumber: 'invoice',
        workshopName: 'workshop',
        itemName: 'item',
        itemKind: 'item_kind',
        itemCategory: 'item_category',
        itemQuantity: 'qty',
        itemUnitPrice: 'rate',
        itemLineTotal: 'amount',
      },
    );

    expect(preview.issues).toEqual([]);
    expect(preview.records).toHaveLength(1);
    expect(preview.records[0]).toEqual(
      expect.objectContaining({
        category: MaintenanceCategory.EngineOil,
        invoiceNumber: 'INV-1',
        workshopName: 'Torque Garage',
        source: MaintenanceSource.Csv,
        status: MaintenanceRecordStatus.Confirmed,
        totalCost: 1850,
      }),
    );
    expect(preview.records[0]?.lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: MaintenanceLineItemKind.Fluid,
          name: 'Engine oil',
        }),
        expect.objectContaining({
          kind: MaintenanceLineItemKind.Part,
          name: 'Oil filter',
        }),
      ]),
    );
  });

  it('creates suggested mappings and defaults missing category values to other', () => {
    const mapping = createSuggestedMaintenanceImportMapping([
      'Service Date',
      'Odometer',
      'Grand Total',
      'Garage',
    ]);

    const preview = parseMaintenanceImportRows(
      [
        {
          'Service Date': '2026-03-05',
          Odometer: '15100',
          'Grand Total': '999',
          Garage: 'DIY',
        },
      ],
      mapping,
    );

    expect(mapping.serviceDate).toBe('Service Date');
    expect(mapping.odometer).toBe('Odometer');
    expect(mapping.totalCost).toBe('Grand Total');
    expect(preview.records[0]).toEqual(
      expect.objectContaining({
        category: MaintenanceCategory.Other,
        totalCost: 999,
      }),
    );
  });

  it('maps amount to item totals for grouped invoice-style CSVs', () => {
    const mapping = createSuggestedMaintenanceImportMapping([
      'date',
      'odometer',
      'invoice',
      'workshop',
      'item',
      'qty',
      'rate',
      'amount',
    ]);

    const preview = parseMaintenanceImportRows(
      [
        {
          date: '2026-03-01',
          odometer: '12000',
          invoice: 'INV-2',
          workshop: 'Torque Garage',
          item: 'Engine oil',
          qty: '3.5',
          rate: '400',
          amount: '1400',
        },
        {
          date: '2026-03-01',
          odometer: '12000',
          invoice: 'INV-2',
          workshop: 'Torque Garage',
          item: 'Oil filter',
          qty: '1',
          rate: '450',
          amount: '450',
        },
      ],
      mapping,
    );

    expect(mapping.itemLineTotal).toBe('amount');
    expect(mapping.totalCost).toBeUndefined();
    expect(preview.records[0]).toEqual(
      expect.objectContaining({
        totalCost: 1850,
      }),
    );
  });
});
