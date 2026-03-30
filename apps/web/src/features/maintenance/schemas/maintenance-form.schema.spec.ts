import { MaintenanceCategory, MaintenanceLineItemKind } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { maintenanceFormSchema } from './maintenance-form.schema';

const baseValues = {
  entryMode: 'detailed' as const,
  serviceDate: '2026-03-30',
  odometer: 12345,
  category: MaintenanceCategory.PeriodicService,
  workshopName: 'Torque Garage',
  invoiceNumber: '',
  currencyCode: 'INR',
  totalCost: 3200,
  notes: '',
  nextDueDate: '',
  nextDueOdometer: undefined,
};

describe('maintenanceFormSchema', () => {
  it('allows blank placeholder rows in detailed mode', () => {
    const result = maintenanceFormSchema.safeParse({
      ...baseValues,
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Job,
          name: '',
          normalizedCategory: undefined,
          quantity: undefined,
          unit: '',
          unitPrice: undefined,
          lineTotal: undefined,
          brand: '',
          partNumber: '',
          notes: '',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('requires a name once a structured line item contains meaningful data', () => {
    const result = maintenanceFormSchema.safeParse({
      ...baseValues,
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: '',
          normalizedCategory: MaintenanceCategory.OilFilter,
          quantity: 1,
          unit: 'pcs',
          unitPrice: 450,
          lineTotal: 450,
          brand: 'Bosch',
          partNumber: 'OF-123',
          notes: '',
        },
      ],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Item name is required for a structured entry',
            path: ['lineItems', 0, 'name'],
          }),
        ]),
      );
    }
  });
});
