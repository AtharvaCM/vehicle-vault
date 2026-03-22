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
                  generations: {
                    some: {
                      variants: {
                        some: {
                          offerings: {
                            some: buildOfferingYearWhere(normalized.year),
                          },
                        },
                      },
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
              generations: {
                some: {
                  variants: {
                    some: {
                      offerings: {
                        some: buildOfferingYearWhere(normalized.year),
                      },
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
        generation: {
          model: {
            name: normalized.model,
            make: {
              marketCode: normalized.marketCode,
              vehicleType: normalized.vehicleType,
              name: normalized.make,
            },
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
              offerings: {
                some: buildOfferingYearWhere(normalized.year),
              },
            }
          : {}),
      },
      include: {
        generation: true,
        offerings: {
          where: normalized.year !== undefined ? buildOfferingYearWhere(normalized.year) : undefined,
          orderBy: [{ isCurrent: 'desc' }, { yearEnd: 'desc' }, { yearStart: 'desc' }],
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return collapseVariantOptions(
      variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        generation: {
          modelId: variant.generation.modelId,
        },
        offerings: variant.offerings.map((offering) => ({
          fuelTypes: offering.fuelTypes as FuelType[],
          yearStart: offering.yearStart,
          yearEnd: offering.yearEnd,
          isCurrent: offering.isCurrent,
        })),
      })),
    );
  }
}

function collapseVariantOptions(
  variants: Array<{
    id: string;
    name: string;
    generation: {
      modelId: string;
    };
    offerings: Array<{
      fuelTypes: FuelType[];
      yearStart: number | null;
      yearEnd: number | null;
      isCurrent: boolean;
    }>;
  }>,
): VehicleCatalogVariantOption[] {
  const groupedByName = new Map<
    string,
    {
      id: string;
      modelId: string;
      name: string;
      fuelTypes: Set<FuelType>;
      yearStart?: number;
      yearEnd?: number;
      isCurrent: boolean;
    }
  >();

  for (const variant of variants) {
    const existing = groupedByName.get(variant.name) ?? {
      id: variant.id,
      modelId: variant.generation.modelId,
      name: variant.name,
      fuelTypes: new Set<FuelType>(),
      yearStart: undefined,
      yearEnd: undefined,
      isCurrent: false,
    };

    for (const offering of variant.offerings) {
      offering.fuelTypes.forEach((fuelType) => existing.fuelTypes.add(fuelType));
      existing.isCurrent ||= offering.isCurrent;
      existing.yearStart = minDefined(existing.yearStart, offering.yearStart ?? undefined);
      existing.yearEnd = maxDefined(existing.yearEnd, offering.yearEnd ?? undefined);
    }

    groupedByName.set(variant.name, existing);
  }

  return [...groupedByName.values()]
    .map((variant) => ({
      id: variant.id,
      modelId: variant.modelId,
      name: variant.name,
      fuelTypes: [...variant.fuelTypes],
      yearStart: variant.yearStart,
      yearEnd: variant.isCurrent ? undefined : variant.yearEnd,
      isCurrent: variant.isCurrent,
    }))
    .sort(compareVariantOptions);
}

function compareVariantOptions(left: VehicleCatalogVariantOption, right: VehicleCatalogVariantOption) {
  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1;
  }

  if ((left.yearEnd ?? Number.MAX_SAFE_INTEGER) !== (right.yearEnd ?? Number.MAX_SAFE_INTEGER)) {
    return (right.yearEnd ?? Number.MAX_SAFE_INTEGER) - (left.yearEnd ?? Number.MAX_SAFE_INTEGER);
  }

  if ((left.yearStart ?? Number.MIN_SAFE_INTEGER) !== (right.yearStart ?? Number.MIN_SAFE_INTEGER)) {
    return (right.yearStart ?? Number.MIN_SAFE_INTEGER) - (left.yearStart ?? Number.MIN_SAFE_INTEGER);
  }

  return left.name.localeCompare(right.name, 'en');
}

function buildOfferingYearWhere(year: number) {
  return {
    AND: [
      {
        OR: [
          {
            yearStart: null,
          },
          {
            yearStart: {
              lte: year,
            },
          },
        ],
      },
      {
        OR: [
          {
            yearEnd: null,
          },
          {
            yearEnd: {
              gte: year,
            },
          },
        ],
      },
    ],
  };
}

function minDefined(current: number | undefined, next: number | undefined) {
  if (current === undefined) {
    return next;
  }

  if (next === undefined) {
    return current;
  }

  return Math.min(current, next);
}

function maxDefined(current: number | undefined, next: number | undefined) {
  if (current === undefined) {
    return next;
  }

  if (next === undefined) {
    return current;
  }

  return Math.max(current, next);
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
