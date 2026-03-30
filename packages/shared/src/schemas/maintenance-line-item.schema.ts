import { z } from 'zod';

import { MaintenanceCategory, MaintenanceLineItemKind } from '../enums';

const isoDateTimeString = z.string().datetime({ offset: true });
const jsonObjectSchema = z.record(z.unknown());

export const MaintenanceLineItemCreateSchema = z.object({
  kind: z.nativeEnum(MaintenanceLineItemKind),
  name: z.string().trim().min(1).max(160),
  normalizedCategory: z.nativeEnum(MaintenanceCategory).optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().trim().max(24).optional(),
  unitPrice: z.number().nonnegative().optional(),
  lineTotal: z.number().nonnegative().optional(),
  brand: z.string().trim().max(80).optional(),
  partNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  position: z.number().int().nonnegative().optional(),
  metadata: jsonObjectSchema.optional(),
});

export const MaintenanceLineItemSchema = MaintenanceLineItemCreateSchema.extend({
  id: z.string().trim().min(1),
  maintenanceRecordId: z.string().trim().min(1),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
