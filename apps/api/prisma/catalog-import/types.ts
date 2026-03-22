import type { FuelType, VehicleType } from '@prisma/client';

export type CatalogOfferingInput = {
  fuelTypes: FuelType[];
  yearStart?: number;
  yearEnd?: number;
  isCurrent?: boolean;
  sourceUrl?: string;
};

export type CatalogVariantInput = {
  name: string;
  sourceUrl?: string;
  offerings: CatalogOfferingInput[];
};

export type CatalogGenerationInput = {
  name: string;
  yearStart?: number;
  yearEnd?: number;
  isCurrent?: boolean;
  sourceUrl?: string;
  variants: CatalogVariantInput[];
};

export type CatalogModelInput = {
  name: string;
  sourceUrl?: string;
  generations: CatalogGenerationInput[];
};

export type CatalogMakeInput = {
  marketCode: string;
  vehicleType: VehicleType;
  name: string;
  sourceUrl?: string;
  models: CatalogModelInput[];
};

export type CatalogDataset = CatalogMakeInput[];

export type CatalogImportSource = {
  marketCode: string;
  sourceKey: string;
  sourceUrl: string;
  capturedAt: string;
  dataset: CatalogDataset;
};
