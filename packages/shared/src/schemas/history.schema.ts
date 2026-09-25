import { z } from 'zod';

import { MaintenanceCategory, MaintenanceRecordStatus } from '../enums';

/** What the garage-wide History timeline lists: logged work, fills and readings. */
export const HISTORY_KINDS = ['service', 'fuel', 'odometer'] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

export const HISTORY_PAGE_DEFAULT_LIMIT = 30;
export const HISTORY_PAGE_MAX_LIMIT = 100;
export const HISTORY_SEARCH_MAX_LENGTH = 100;

export const HistoryQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  kind: z.enum(HISTORY_KINDS).optional(),
  /**
   * Words to find: a service's category, workshop, invoice number or notes, or a
   * fill's station or notes. Odometer readings carry no words, so a search
   * leaves them out.
   */
  search: z.string().trim().min(1).max(HISTORY_SEARCH_MAX_LENGTH).optional(),
  /** Opaque: the `nextCursor` of the page before. */
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(HISTORY_PAGE_MAX_LIMIT).optional(),
});

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/);
/** A calendar month on the Indian calendar (UTC+05:30), the one dates are shown in. */
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);

const HistoryEntryBase = z.object({
  /** The id of the row it comes from: a maintenance record, a fuel log or an audit event. */
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  month: monthKey,
});

export const HistoryServiceEntrySchema = HistoryEntryBase.extend({
  kind: z.literal('service'),
  category: z.nativeEnum(MaintenanceCategory),
  status: z.nativeEnum(MaintenanceRecordStatus),
  workshopName: z.string().nullable(),
  odometer: z.number().int().nonnegative(),
  totalCost: decimalString,
  currencyCode: z.string(),
});

export const HistoryFuelEntrySchema = HistoryEntryBase.extend({
  kind: z.literal('fuel'),
  quantity: z.number().nonnegative(),
  location: z.string().nullable(),
  odometer: z.number().int().nonnegative(),
  totalCost: decimalString,
});

export const HistoryOdometerEntrySchema = HistoryEntryBase.extend({
  kind: z.literal('odometer'),
  odometer: z.number().int().nonnegative(),
  /** The reading it replaced, when the trail kept one. */
  previousOdometer: z.number().int().nonnegative().nullable(),
});

export const HistoryEntrySchema = z.discriminatedUnion('kind', [
  HistoryServiceEntrySchema,
  HistoryFuelEntrySchema,
  HistoryOdometerEntrySchema,
]);

export const HistoryMonthSchema = z.object({
  month: monthKey,
  /**
   * Confirmed service and fuel spend in the whole month under the same filters,
   * not just the rows on this page. Drafts are never in it. Null when the month
   * has no spend the filters can count (odometer readings only, or drafts only).
   */
  total: decimalString.nullable(),
  /** Drafts in the month under the same filters: listed, not counted. */
  draftCount: z.number().int().nonnegative(),
});

export const HistoryPageSchema = z.object({
  entries: z.array(HistoryEntrySchema),
  /** One per month the entries fall in, newest first. */
  months: z.array(HistoryMonthSchema),
  /** Drafts waiting to be confirmed on the filtered vehicles, across all time. */
  draftCount: z.number().int().nonnegative(),
  /**
   * The oldest of those drafts, where "N drafts to confirm" leads. Null when
   * there is none. Omitted by older API versions.
   */
  firstDraftId: z.string().nullable().optional(),
  /**
   * This calendar year's confirmed services on the filtered vehicles, for the
   * page's summary line ("₹15,200 on 3 services in 2026"). A search does not
   * narrow it. Null when the kind filter leaves services out. Omitted by older
   * API versions.
   */
  year: z
    .object({
      year: z.number().int(),
      serviceCount: z.number().int().nonnegative(),
      serviceSpend: decimalString,
    })
    .nullable()
    .optional(),
  nextCursor: z.string().nullable(),
});

export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
export type HistoryServiceEntry = z.infer<typeof HistoryServiceEntrySchema>;
export type HistoryFuelEntry = z.infer<typeof HistoryFuelEntrySchema>;
export type HistoryOdometerEntry = z.infer<typeof HistoryOdometerEntrySchema>;
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type HistoryMonth = z.infer<typeof HistoryMonthSchema>;
export type HistoryPage = z.infer<typeof HistoryPageSchema>;
