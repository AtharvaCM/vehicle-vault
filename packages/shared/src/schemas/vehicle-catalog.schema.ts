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
