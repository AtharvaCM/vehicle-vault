import type { z } from 'zod';

import { AccountExportMetaSchema, AccountExportSchema, ExportFormatSchema } from '../schemas';

export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type AccountExportMeta = z.infer<typeof AccountExportMetaSchema>;
export type AccountExport = z.infer<typeof AccountExportSchema>;
