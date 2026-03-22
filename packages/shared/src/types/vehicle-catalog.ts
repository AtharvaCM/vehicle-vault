import type { z } from 'zod';

import {
  VehicleCatalogImportDatasetSchema,
  VehicleCatalogPublishedOfferingReviewSchema,
  UpdateVehicleCatalogOfferingReviewInputSchema,
  VehicleCatalogImportRunDetailSchema,
  VehicleCatalogImportRunReviewSchema,
  VehicleCatalogMakeOptionSchema,
  VehicleCatalogMakeQuerySchema,
  VehicleCatalogModelOptionSchema,
  VehicleCatalogModelQuerySchema,
  VehicleCatalogVariantOptionSchema,
  VehicleCatalogVariantQuerySchema,
} from '../schemas';

export type VehicleCatalogMakeOption = z.infer<typeof VehicleCatalogMakeOptionSchema>;
export type VehicleCatalogModelOption = z.infer<typeof VehicleCatalogModelOptionSchema>;
export type VehicleCatalogVariantOption = z.infer<typeof VehicleCatalogVariantOptionSchema>;
export type VehicleCatalogImportDataset = z.infer<typeof VehicleCatalogImportDatasetSchema>;
export type VehicleCatalogPublishedOfferingReview = z.infer<
  typeof VehicleCatalogPublishedOfferingReviewSchema
>;
export type UpdateVehicleCatalogOfferingReviewInput = z.infer<
  typeof UpdateVehicleCatalogOfferingReviewInputSchema
>;
export type VehicleCatalogImportRunReview = z.infer<typeof VehicleCatalogImportRunReviewSchema>;
export type VehicleCatalogImportRunDetail = z.infer<typeof VehicleCatalogImportRunDetailSchema>;
export type VehicleCatalogMakeQuery = z.infer<typeof VehicleCatalogMakeQuerySchema>;
export type VehicleCatalogModelQuery = z.infer<typeof VehicleCatalogModelQuerySchema>;
export type VehicleCatalogVariantQuery = z.infer<typeof VehicleCatalogVariantQuerySchema>;
