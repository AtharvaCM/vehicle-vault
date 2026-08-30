import { describe, expect, it } from 'vitest';
import { MaintenanceCategory, MaintenanceLineItemKind } from '@vehicle-vault/shared';

import { MaintenanceInvoiceExtractionSpec } from './maintenance-invoice.extraction';

describe('MaintenanceInvoiceExtractionSpec.normalize', () => {
  const spec = new MaintenanceInvoiceExtractionSpec();

  it('stores a signed discount as a positive magnitude', () => {
    // The kind carries the sign: a discount is subtracted from the total downstream,
    // so a negative lineTotal here makes the whole record fail validation on apply.
    const result = spec.normalize({
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Discount,
          name: 'Discount',
          lineTotal: -11.83,
          unitPrice: -11.83,
        },
      ],
    });

    expect(result.lineItems?.[0]).toMatchObject({
      kind: MaintenanceLineItemKind.Discount,
      lineTotal: 11.83,
      unitPrice: 11.83,
    });
  });

  it('leaves positive amounts untouched', () => {
    const result = spec.normalize({
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: 'Oil filter',
          quantity: 2,
          unitPrice: 250,
          lineTotal: 500,
        },
      ],
    });

    expect(result.lineItems?.[0]).toMatchObject({ quantity: 2, unitPrice: 250, lineTotal: 500 });
  });

  it('passes through valid header fields', () => {
    const result = spec.normalize({
      confidence: 0.91,
      vendorName: 'Torque Garage',
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-42',
      documentDate: '2026-03-19',
      serviceDate: '2026-03-20',
      odometer: 12500,
      totalCost: 2499,
      currencyCode: 'inr',
      notes: 'Routine service',
    });

    expect(result).toMatchObject({
      confidence: 0.91,
      vendorName: 'Torque Garage',
      invoiceNumber: 'INV-42',
      odometer: 12500,
      totalCost: 2499,
      currencyCode: 'INR',
      notes: 'Routine service',
    });
  });

  it('drops invalid currency codes', () => {
    expect(spec.normalize({ currencyCode: 'INDIAN' }).currencyCode).toBeUndefined();
    expect(spec.normalize({ currencyCode: 'US' }).currencyCode).toBeUndefined();
  });

  it('rounds odometer to integer', () => {
    expect(spec.normalize({ odometer: 12500.7 }).odometer).toBe(12501);
  });

  it('filters line items missing name or kind', () => {
    const result = spec.normalize({
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: 'Oil filter',
          normalizedCategory: MaintenanceCategory.OilFilter,
          quantity: 1,
          unitPrice: 450,
          lineTotal: 450,
        },
        { kind: MaintenanceLineItemKind.Part },
        { name: 'No kind item' },
        { kind: 'not-a-real-kind', name: 'Unknown kind' },
      ],
    });

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems?.[0]).toMatchObject({
      kind: MaintenanceLineItemKind.Part,
      name: 'Oil filter',
      normalizedCategory: MaintenanceCategory.OilFilter,
    });
  });

  it('drops unknown normalizedCategory values', () => {
    const result = spec.normalize({
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: 'Mystery part',
          normalizedCategory: 'not_a_category',
        },
      ],
    });

    expect(result.lineItems?.[0].normalizedCategory).toBeUndefined();
  });

  it('returns lineItems as undefined when none survive filtering', () => {
    const result = spec.normalize({
      lineItems: [{ name: 'No kind' }, { kind: 'invalid', name: 'Also bad' }],
    });
    expect(result.lineItems).toBeUndefined();
  });

  it('handles null input', () => {
    expect(spec.normalize(null)).toMatchObject({
      confidence: undefined,
      vendorName: undefined,
      lineItems: undefined,
    });
  });
});
