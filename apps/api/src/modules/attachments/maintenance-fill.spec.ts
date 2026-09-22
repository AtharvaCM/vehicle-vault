import {
  AttachmentExtractionStatus,
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
  type AttachmentExtraction,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { getLineItemBreakdown, planMaintenanceFill } from './maintenance-fill';

/** What the dashboard's quick log saves: date, odometer and cost, category `other`. */
const quickLog: MaintenanceRecord = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  category: MaintenanceCategory.Other,
  serviceDate: '2026-09-20T00:00:00.000Z',
  odometer: 15200,
  currencyCode: 'INR',
  source: MaintenanceSource.Manual,
  status: MaintenanceRecordStatus.Confirmed,
  totalCost: 1500,
  lineItems: [],
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

/** A job card read in full, disagreeing with the quick log on date, odometer and total. */
const jobCard: AttachmentExtraction = {
  id: 'extraction-1',
  attachmentId: 'attachment-1',
  status: AttachmentExtractionStatus.Completed,
  vendorName: 'Torque Motors Pvt Ltd',
  workshopName: 'Torque Garage',
  invoiceNumber: 'INV-77',
  serviceDate: '2026-09-18T00:00:00.000Z',
  odometer: 15180,
  totalCost: 1520,
  currencyCode: 'INR',
  notes: 'Oil and filter change, chain cleaned',
  lineItems: [
    {
      kind: MaintenanceLineItemKind.Fluid,
      name: 'Engine oil 10W-30',
      normalizedCategory: MaintenanceCategory.EngineOil,
      quantity: 1,
      lineTotal: 900,
    },
    {
      kind: MaintenanceLineItemKind.Part,
      name: 'Oil filter',
      normalizedCategory: MaintenanceCategory.OilFilter,
      quantity: 1,
      unitPrice: 250,
    },
    { kind: MaintenanceLineItemKind.Labor, name: 'Labour', lineTotal: 400 },
    { kind: MaintenanceLineItemKind.Tax, name: 'GST', lineTotal: 100 },
    { kind: MaintenanceLineItemKind.Discount, name: 'Loyalty discount', lineTotal: 150 },
  ],
  nextDueDate: '2027-03-18T00:00:00.000Z',
  nextDueOdometer: 18200,
  createdAt: '2026-09-20T10:05:00.000Z',
  updatedAt: '2026-09-20T10:05:00.000Z',
};

describe('planMaintenanceFill', () => {
  it("fills every blank a quick log leaves, from the job card's own answers", () => {
    const plan = planMaintenanceFill(quickLog, jobCard);

    expect(plan.fields).toEqual([
      'category',
      'workshopName',
      'invoiceNumber',
      'notes',
      'lineItems',
      'nextDueDate',
      'nextDueOdometer',
    ]);
    expect(plan.changes).toEqual({
      category: MaintenanceCategory.EngineOil,
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-77',
      notes: 'Oil and filter change, chain cleaned',
      lineItems: jobCard.lineItems!.map((item, position) => ({ ...item, position })),
      laborCost: 400,
      partsCost: 250,
      fluidsCost: 900,
      taxCost: 100,
      discountAmount: 150,
      nextDueDate: '2027-03-18T00:00:00.000Z',
      nextDueOdometer: 18200,
    });
    expect(plan.lineItemsLeftOut).toBeUndefined();
  });

  it('never writes the date, odometer or cost typed at the counter, whatever the photo says', () => {
    const { changes } = planMaintenanceFill(quickLog, jobCard);

    expect(changes).not.toHaveProperty('serviceDate');
    expect(changes).not.toHaveProperty('odometer');
    expect(changes).not.toHaveProperty('totalCost');
    // Nor the currency the cost was typed in, nor what kind of record it is.
    expect(changes).not.toHaveProperty('currencyCode');
    expect(changes).not.toHaveProperty('status');
    expect(changes).not.toHaveProperty('source');
  });

  it('leaves alone every field someone already filled in', () => {
    const typed: MaintenanceRecord = {
      ...quickLog,
      category: MaintenanceCategory.PeriodicService,
      workshopName: 'My usual garage',
      invoiceNumber: 'JC-1',
      notes: 'Asked them to check the brakes',
      laborCost: 1500,
      lineItems: [
        {
          id: 'item-1',
          maintenanceRecordId: 'record-1',
          kind: MaintenanceLineItemKind.Labor,
          name: 'Service',
          lineTotal: 1500,
          position: 0,
          createdAt: '2026-09-20T10:00:00.000Z',
          updatedAt: '2026-09-20T10:00:00.000Z',
        },
      ],
      nextDueDate: '2027-01-01T00:00:00.000Z',
      nextDueOdometer: 20000,
    };

    expect(planMaintenanceFill(typed, jobCard)).toEqual({ fields: [], changes: {} });
  });

  it('fills only the blanks that remain around what was typed', () => {
    const plan = planMaintenanceFill(
      { ...quickLog, workshopName: 'My usual garage', nextDueOdometer: 20000 },
      jobCard,
    );

    expect(plan.fields).toEqual(['category', 'invoiceNumber', 'notes', 'lineItems', 'nextDueDate']);
    expect(plan.changes).not.toHaveProperty('workshopName');
    expect(plan.changes).not.toHaveProperty('nextDueOdometer');
  });

  it('keeps a cost breakdown already on the record and adds only the parts it lacks', () => {
    const { changes } = planMaintenanceFill({ ...quickLog, laborCost: 350 }, jobCard);

    expect(changes.laborCost).toBeUndefined();
    expect(changes.partsCost).toBe(250);
  });

  it('leaves out line items that add up to something other than the typed cost', () => {
    // The edit form works a record's cost out from its line items, so these would
    // turn the typed 1,500 into 1,480 at the next save.
    const plan = planMaintenanceFill(quickLog, {
      ...jobCard,
      lineItems: jobCard.lineItems!.map((item) =>
        item.kind === MaintenanceLineItemKind.Tax ? { ...item, lineTotal: 80 } : item,
      ),
    });

    expect(plan.fields).not.toContain('lineItems');
    expect(plan.changes.lineItems).toBeUndefined();
    expect(plan.changes.laborCost).toBeUndefined();
    expect(plan.lineItemsLeftOut).toEqual({ count: 5, total: 1480 });
    // The rest still comes through.
    expect(plan.fields).toContain('workshopName');
  });

  it('takes the category from the first line item that names one other than `other`', () => {
    const plan = planMaintenanceFill(quickLog, {
      ...jobCard,
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Other,
          name: 'Misc',
          normalizedCategory: MaintenanceCategory.Other,
          lineTotal: 0,
        },
        ...jobCard.lineItems!,
      ],
    });

    expect(plan.changes.category).toBe(MaintenanceCategory.EngineOil);
  });

  it('does not guess a category the photo does not show', () => {
    const plan = planMaintenanceFill(quickLog, {
      ...jobCard,
      lineItems: jobCard.lineItems!.map(({ normalizedCategory: _dropped, ...item }) => item),
    });

    expect(plan.fields).not.toContain('category');
  });

  it('falls back to the vendor when the job card names no workshop', () => {
    const plan = planMaintenanceFill(quickLog, { ...jobCard, workshopName: undefined });

    expect(plan.changes.workshopName).toBe('Torque Motors Pvt Ltd');
  });

  it('skips a next-due that is not after this service: that is the visit itself, misread', () => {
    const plan = planMaintenanceFill(quickLog, {
      ...jobCard,
      nextDueDate: quickLog.serviceDate,
      nextDueOdometer: 15200,
    });

    expect(plan.fields).not.toContain('nextDueDate');
    expect(plan.fields).not.toContain('nextDueOdometer');
  });

  it('cuts notes down to what a record can hold', () => {
    const plan = planMaintenanceFill(quickLog, { ...jobCard, notes: 'x'.repeat(1200) });

    expect(plan.changes.notes).toHaveLength(1000);
    expect(plan.changes.notes?.endsWith('…')).toBe(true);
  });

  it('has nothing to add from an extraction that read nothing', () => {
    const plan = planMaintenanceFill(quickLog, {
      id: 'extraction-2',
      attachmentId: 'attachment-1',
      status: AttachmentExtractionStatus.Completed,
      createdAt: '2026-09-20T10:05:00.000Z',
      updatedAt: '2026-09-20T10:05:00.000Z',
    });

    expect(plan).toEqual({ fields: [], changes: {} });
  });
});

describe('getLineItemBreakdown', () => {
  it('splits the cost by kind, takes a discount off, and rounds to the paisa', () => {
    expect(
      getLineItemBreakdown([
        // 3 × 0.1 is 0.30000000000000004 in floating point.
        { kind: MaintenanceLineItemKind.Part, quantity: 3, unitPrice: 0.1 },
        { kind: MaintenanceLineItemKind.Labor, lineTotal: 200 },
        { kind: MaintenanceLineItemKind.Discount, lineTotal: 0.1 },
        { kind: MaintenanceLineItemKind.Other },
      ]),
    ).toEqual({
      totalCost: 200.2,
      laborCost: 200,
      partsCost: 0.3,
      fluidsCost: 0,
      taxCost: 0,
      discountAmount: 0.1,
    });
  });
});
