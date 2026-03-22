import { z } from 'zod';

import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  FuelType,
  VehicleCatalogMarket,
  VehicleType,
} from '../enums';

export const VehicleCatalogMakeOptionSchema = z.object({
  id: z.string().trim().min(1),
  marketCode: z.nativeEnum(VehicleCatalogMarket),
  vehicleType: z.nativeEnum(VehicleType),
  name: z.string().trim().min(1),
});

export const VehicleCatalogModelOptionSchema = z.object({
  id: z.string().trim().min(1),
  makeId: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export const VehicleCatalogVariantOptionSchema = z.object({
  id: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  fuelTypes: z.array(z.nativeEnum(FuelType)),
  isCurrent: z.boolean(),
  yearEnd: z.number().int().optional(),
  yearStart: z.number().int().optional(),
});

export const VehicleCatalogMakeQuerySchema = z.object({
  marketCode: z.nativeEnum(VehicleCatalogMarket).default(DEFAULT_VEHICLE_CATALOG_MARKET),
  query: z.string().trim().optional(),
  vehicleType: z.nativeEnum(VehicleType),
  year: z.number().int().min(1900).max(2100).optional(),
});

export const VehicleCatalogModelQuerySchema = z.object({
  make: z.string().trim().min(1),
  marketCode: z.nativeEnum(VehicleCatalogMarket).default(DEFAULT_VEHICLE_CATALOG_MARKET),
  query: z.string().trim().optional(),
  vehicleType: z.nativeEnum(VehicleType),
  year: z.number().int().min(1900).max(2100).optional(),
});

export const VehicleCatalogVariantQuerySchema = z.object({
  make: z.string().trim().min(1),
  marketCode: z.nativeEnum(VehicleCatalogMarket).default(DEFAULT_VEHICLE_CATALOG_MARKET),
  model: z.string().trim().min(1),
  query: z.string().trim().optional(),
  vehicleType: z.nativeEnum(VehicleType),
  year: z.number().int().min(1900).max(2100).optional(),
});

export const VehicleCatalogImportRunStatusSchema = z.enum(['running', 'succeeded', 'failed']);

export const VehicleCatalogImportOfferingSchema = z.object({
  fuelTypes: z.array(z.nativeEnum(FuelType)),
  isCurrent: z.boolean().optional(),
  sourceUrl: z.string().trim().url().optional(),
  yearEnd: z.number().int().optional(),
  yearStart: z.number().int().optional(),
});

export const VehicleCatalogImportVariantSchema = z.object({
  name: z.string().trim().min(1),
  offerings: z.array(VehicleCatalogImportOfferingSchema).min(1),
  sourceUrl: z.string().trim().url().optional(),
});

export const VehicleCatalogImportGenerationSchema = z.object({
  isCurrent: z.boolean().optional(),
  name: z.string().trim().min(1),
  sourceUrl: z.string().trim().url().optional(),
  variants: z.array(VehicleCatalogImportVariantSchema).min(1),
  yearEnd: z.number().int().optional(),
  yearStart: z.number().int().optional(),
});

export const VehicleCatalogImportModelSchema = z.object({
  generations: z.array(VehicleCatalogImportGenerationSchema).min(1),
  name: z.string().trim().min(1),
  sourceUrl: z.string().trim().url().optional(),
});

export const VehicleCatalogImportMakeSchema = z.object({
  marketCode: z.string().trim().length(2),
  models: z.array(VehicleCatalogImportModelSchema).min(1),
  name: z.string().trim().min(1),
  sourceUrl: z.string().trim().url().optional(),
  vehicleType: z.nativeEnum(VehicleType),
});

export const VehicleCatalogImportDatasetSchema = z.array(VehicleCatalogImportMakeSchema);

export const VehicleCatalogImportCountsSchema = z.object({
  generations: z.number().int().nonnegative(),
  makes: z.number().int().nonnegative(),
  models: z.number().int().nonnegative(),
  offerings: z.number().int().nonnegative(),
  variants: z.number().int().nonnegative(),
});

export const VehicleCatalogImportDiffSchema = z.object({
  changedVariants: z.array(z.string()),
  incomingCounts: VehicleCatalogImportCountsSchema,
  missingVariants: z.array(z.string()),
  newModels: z.array(z.string()),
  newVariants: z.array(z.string()),
  publishedCounts: VehicleCatalogImportCountsSchema,
});

export const VehicleCatalogImportRunReviewSchema = z.object({
  completedAt: z.string().datetime().optional(),
  diff: VehicleCatalogImportDiffSchema,
  id: z.string().trim().min(1),
  marketCode: z.string().trim().length(2),
  notes: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  publishedByUserId: z.string().trim().min(1).optional(),
  recordsUpserted: z.number().int().nonnegative(),
  snapshotCapturedAt: z.string().datetime().optional(),
  snapshotCount: z.number().int().nonnegative(),
  sourceKey: z.string().trim().min(1),
  startedAt: z.string().datetime(),
  status: VehicleCatalogImportRunStatusSchema,
});

export const VehicleCatalogPublishedOfferingReviewSchema = z.object({
  fuelTypes: z.array(z.nativeEnum(FuelType)),
  generationName: z.string().trim().min(1),
  id: z.string().trim().min(1),
  isCurrent: z.boolean(),
  makeName: z.string().trim().min(1),
  manualOverrideApplied: z.boolean(),
  modelName: z.string().trim().min(1),
  reviewNote: z.string().optional(),
  sourceUrl: z.string().trim().url().optional(),
  variantName: z.string().trim().min(1),
  yearEnd: z.number().int().optional(),
  yearStart: z.number().int().optional(),
});

export const UpdateVehicleCatalogOfferingReviewInputSchema = z
  .object({
    isCurrent: z.boolean().optional(),
    reviewNote: z.string().trim().max(500).nullable().optional(),
    yearEnd: z.number().int().min(1900).max(2100).nullable().optional(),
    yearStart: z.number().int().min(1900).max(2100).nullable().optional(),
  })
  .refine(
    (value) =>
      value.yearStart === undefined ||
      value.yearEnd === undefined ||
      value.yearStart === null ||
      value.yearEnd === null ||
      value.yearEnd >= value.yearStart,
    {
      message: 'End year cannot be earlier than start year.',
      path: ['yearEnd'],
    },
  );

export const VehicleCatalogImportRunDetailSchema = VehicleCatalogImportRunReviewSchema.extend({
  dataset: VehicleCatalogImportDatasetSchema,
  publishedOfferings: z.array(VehicleCatalogPublishedOfferingReviewSchema),
});
