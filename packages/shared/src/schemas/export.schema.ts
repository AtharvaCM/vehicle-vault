import { z } from 'zod';

import { AttachmentSchema } from './attachment.schema';
import { UserSchema } from './auth.schema';
import { MaintenanceRecordSchema } from './maintenance-record.schema';
import { ReminderSchema } from './reminder.schema';
import { VehicleSchema } from './vehicle.schema';

const isoDateTimeString = z.string().datetime({ offset: true });

export const ExportFormatSchema = z.enum(['json']);

export const AccountExportMetaSchema = z.object({
  format: ExportFormatSchema,
  fileName: z.string().trim().min(1),
});

export const AccountExportSchema = z.object({
  version: z.literal(1),
  exportedAt: isoDateTimeString,
  user: UserSchema,
  vehicles: z.array(VehicleSchema),
  maintenanceRecords: z.array(MaintenanceRecordSchema),
  reminders: z.array(ReminderSchema),
  attachments: z.array(AttachmentSchema),
});
