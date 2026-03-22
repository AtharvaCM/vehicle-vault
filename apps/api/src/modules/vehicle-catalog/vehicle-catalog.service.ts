import { Injectable } from '@nestjs/common';
import {
  FuelType,
  VehicleCatalogMarket,
  VehicleType,
  type VehicleCatalogMakeOption,
  type VehicleCatalogMakeQuery,
  type VehicleCatalogModelOption,
  type VehicleCatalogModelQuery,
  type VehicleCatalogVariantOption,
  type VehicleCatalogVariantQuery,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ListVehicleCatalogMakesDto } from './dto/list-vehicle-catalog-makes.dto';
import { ListVehicleCatalogModelsDto } from './dto/list-vehicle-catalog-models.dto';
import { ListVehicleCatalogVariantsDto } from './dto/list-vehicle-catalog-variants.dto';

@Injectable()
export class VehicleCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listMakes(query: ListVehicleCatalogMakesDto): Promise<VehicleCatalogMakeOption[]> {
    const normalized = normalizeMakeQuery(query);
    const makes = await this.prisma.vehicleCatalogMake.findMany({
      where: {
        marketCode: normalized.marketCode,
        vehicleType: normalized.vehicleType,
        ...(normalized.query
          ? {
              name: {
                contains: normalized.query,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(normalized.year !== undefined
          ? {
              models: {
                some: {
                  variants: {
                    some: {
                      OR: [
                        {
                          yearStart: null,
                        },
                        {
                          yearStart: {
                            lte: normalized.year,
                          },
                        },
                      ],
                      AND: [
                        {
                          OR: [
                            {
                              yearEnd: null,
                            },
                            {
                              yearEnd: {
                                gte: normalized.year,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            }
          : {}),
      },
      orderBy: {
        name: 'asc',
      },
    });

    return makes.map((make) => ({
      id: make.id,
      marketCode: make.marketCode as VehicleCatalogMarket,
      vehicleType: make.vehicleType as VehicleType,
      name: make.name,
    }));
  }

  async listModels(query: ListVehicleCatalogModelsDto): Promise<VehicleCatalogModelOption[]> {
    const normalized = normalizeModelQuery(query);
    const models = await this.prisma.vehicleCatalogModel.findMany({
      where: {
        make: {
          marketCode: normalized.marketCode,
          vehicleType: normalized.vehicleType,
          name: normalized.make,
        },
        ...(normalized.query
          ? {
              name: {
                contains: normalized.query,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(normalized.year !== undefined
          ? {
              variants: {
                some: {
                  OR: [
                    {
                      yearStart: null,
                    },
                    {
                      yearStart: {
                        lte: normalized.year,
                      },
                    },
                  ],
                  AND: [
                    {
                      OR: [
                        {
                          yearEnd: null,
                        },
                        {
                          yearEnd: {
                            gte: normalized.year,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            }
          : {}),
      },
      orderBy: {
        name: 'asc',
      },
    });

    return models.map((model) => ({
      id: model.id,
      makeId: model.makeId,
      name: model.name,
    }));
  }

  async listVariants(query: ListVehicleCatalogVariantsDto): Promise<VehicleCatalogVariantOption[]> {
    const normalized = normalizeVariantQuery(query);
    const variants = await this.prisma.vehicleCatalogVariant.findMany({
      where: {
        model: {
          name: normalized.model,
          make: {
            marketCode: normalized.marketCode,
            vehicleType: normalized.vehicleType,
            name: normalized.make,
          },
        },
        ...(normalized.query
          ? {
              name: {
                contains: normalized.query,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(normalized.year !== undefined
          ? {
              OR: [
                {
                  yearStart: null,
                },
                {
                  yearStart: {
                    lte: normalized.year,
                  },
                },
              ],
              AND: [
                {
                  OR: [
                    {
                      yearEnd: null,
                    },
                    {
                      yearEnd: {
                        gte: normalized.year,
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ isCurrent: 'desc' }, { yearEnd: 'desc' }, { yearStart: 'desc' }, { name: 'asc' }],
    });

    return variants.map((variant) => ({
      id: variant.id,
      modelId: variant.modelId,
      name: variant.name,
      fuelTypes: variant.fuelTypes as FuelType[],
      yearStart: variant.yearStart ?? undefined,
      yearEnd: variant.yearEnd ?? undefined,
      isCurrent: variant.isCurrent,
    }));
  }
}

function normalizeMakeQuery(query: ListVehicleCatalogMakesDto): VehicleCatalogMakeQuery {
  return {
    marketCode: query.marketCode,
    vehicleType: query.vehicleType,
    year: query.year,
    query: normalizeSearch(query.query),
  };
}

function normalizeModelQuery(query: ListVehicleCatalogModelsDto): VehicleCatalogModelQuery {
  return {
    marketCode: query.marketCode,
    vehicleType: query.vehicleType,
    make: query.make.trim(),
    year: query.year,
    query: normalizeSearch(query.query),
  };
}

function normalizeVariantQuery(query: ListVehicleCatalogVariantsDto): VehicleCatalogVariantQuery {
  return {
    marketCode: query.marketCode,
    vehicleType: query.vehicleType,
    make: query.make.trim(),
    model: query.model.trim(),
    year: query.year,
    query: normalizeSearch(query.query),
  };
}

function normalizeSearch(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
