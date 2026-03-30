import { MaintenanceCategory, MaintenanceLineItemKind } from '@vehicle-vault/shared';
import { z } from 'zod';

const maintenanceLineItemFormSchema = z.object({
  kind: z.nativeEnum(MaintenanceLineItemKind),
  name: z.string().trim().max(160, 'Item name can be at most 160 characters').optional(),
  normalizedCategory: z.nativeEnum(MaintenanceCategory).optional(),
  quantity: z.number().nonnegative('Quantity cannot be negative').optional(),
  unit: z.string().trim().max(24, 'Unit can be at most 24 characters').optional(),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').optional(),
  lineTotal: z.number().nonnegative('Line total cannot be negative').optional(),
  brand: z.string().trim().max(80, 'Brand can be at most 80 characters').optional(),
  partNumber: z.string().trim().max(80, 'Part number can be at most 80 characters').optional(),
  notes: z.string().trim().max(1000, 'Item notes can be at most 1000 characters').optional(),
});

function isMeaningfulMaintenanceLineItem(lineItem: z.infer<typeof maintenanceLineItemFormSchema>) {
  return Boolean(
    lineItem.name?.trim() ||
    lineItem.normalizedCategory ||
    lineItem.brand?.trim() ||
    lineItem.partNumber?.trim() ||
    lineItem.unit?.trim() ||
    lineItem.notes?.trim() ||
    typeof lineItem.quantity === 'number' ||
    typeof lineItem.unitPrice === 'number' ||
    typeof lineItem.lineTotal === 'number',
  );
}

export const maintenanceFormSchema = z
  .object({
    entryMode: z.enum(['quick', 'detailed']),
    serviceDate: z.string().trim().min(1, 'Service date is required'),
    odometer: z.number().int().nonnegative('Odometer cannot be negative'),
    category: z.nativeEnum(MaintenanceCategory),
    workshopName: z
      .string()
      .trim()
      .max(120, 'Workshop name can be at most 120 characters')
      .optional(),
    invoiceNumber: z
      .string()
      .trim()
      .max(120, 'Invoice number can be at most 120 characters')
      .optional(),
    currencyCode: z.string().trim().length(3, 'Currency code must be 3 characters long'),
    totalCost: z.number().nonnegative('Total cost cannot be negative'),
    notes: z.string().trim().max(1000, 'Notes can be at most 1000 characters').optional(),
    nextDueDate: z.string().trim().optional(),
    nextDueOdometer: z
      .number()
      .int()
      .nonnegative('Next due odometer cannot be negative')
      .optional(),
    lineItems: z.array(maintenanceLineItemFormSchema),
  })
  .superRefine((value, ctx) => {
    value.lineItems.forEach((lineItem, index) => {
      if (!isMeaningfulMaintenanceLineItem(lineItem)) {
        return;
      }

      if (!lineItem.name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Item name is required for a structured entry',
          path: ['lineItems', index, 'name'],
        });
      }
    });
  });

export type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;
