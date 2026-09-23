import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  FuelType,
  PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES,
  publicCatalogSegmentFor,
  type MaintenanceCategory,
  type PublicCatalogIndex,
  type PublicCatalogIndexEntry,
  type PublicCatalogOffering,
  type PublicCatalogSchedule,
  type PublicCatalogSegment,
  type PublicCatalogSpec,
  type PublicCatalogVariantPage,
  type PublicCatalogVariantPageBatch,
  type VehicleType,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';

/**
 * The spec columns a public page may carry, and nothing else. Picked by name
 * from the row rather than by dropping the unwanted ones, so a column added to
 * the table later stays private until someone lists it here.
 */
export const PUBLIC_SPEC_FIELDS = [
  'engineCc',
  'engineCyl',
  'engineType',
  'engineFuel',
  'powerPs',
  'powerRpm',
  'torqueNm',
  'torqueRpm',
  'transmission',
  'driveType',
  'lengthMm',
  'widthMm',
  'heightMm',
  'wheelbaseMm',
  'kerbWeightKg',
  'bootSpaceLitres',
  'groundClearanceMm',
  'topSpeedKph',
  'mileageCity',
  'mileageHighway',
  'mileageCombined',
  'fuelCapLitres',
  'seatingCapacity',
  'bodyType',
  'doors',
  'tyreSize',
  'wheelSizeInch',
  'airbagCount',
  'ncapStarsAdult',
  'ncapStarsChild',
  'ncapRegion',
  'hasAbs',
  'hasEsc',
  'batteryKwh',
  'rangeKm',
  'motorKw',
  'acChargeKw',
  'dcFastChargeKw',
  'chargeTime0To80Min',
  'gearCount',
  'coolingType',
  'seatHeightMm',
  'brakeFrontType',
  'brakeRearType',
  'absChannels',
] as const satisfies ReadonlyArray<keyof PublicCatalogSpec>;

type SpecRow = Record<(typeof PUBLIC_SPEC_FIELDS)[number], unknown> & { updatedAt: Date };

type OfferingRow = {
  fuelTypes: string[];
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
  updatedAt: Date;
};

const VARIANT_PAGE_INCLUDE = {
  offerings: true,
  spec: true,
  generation: { include: { model: { include: { make: true } } } },
} satisfies Prisma.VehicleCatalogVariantInclude;

type VariantPageRow = Prisma.VehicleCatalogVariantGetPayload<{
  include: typeof VARIANT_PAGE_INCLUDE;
}>;

/**
 * Every publishable variant, across both segments: the same rule the slug
 * lookup applies, without the slugs. The index and the bulk pages share it, so
 * the prerender never lists a page the variant endpoint would call not found.
 */
const PUBLISHABLE_VARIANT_WHERE = {
  offerings: { some: {} },
  generation: {
    model: {
      make: {
        marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
        vehicleType: { in: Object.values(PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES).flat() },
      },
    },
  },
} satisfies Prisma.VehicleCatalogVariantWhereInput;

/** Index and bulk pages list variants in the same, stable order. */
const PUBLISHABLE_VARIANT_ORDER = {
  id: 'asc',
} satisfies Prisma.VehicleCatalogVariantOrderByWithRelationInput;

export type PublicVariantSlugs = {
  segment: PublicCatalogSegment;
  make: string;
  model: string;
  generation: string;
  variant: string;
};

/**
 * Builds the page-shaped payloads the public catalog pages render. It owns what
 * "publishable" means — an India-market variant with at least one offering, of
 * a type that has a public segment — and the spec allow-list above. It reads
 * catalog reference data only: nothing about users, vehicles, grants or import
 * runs, and no source names or URLs, ever leaves it.
 */
@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intervalResolver: MaintenanceIntervalResolver,
  ) {}

  async getVariantPage(slugs: PublicVariantSlugs): Promise<PublicCatalogVariantPage> {
    const variant = await this.prisma.vehicleCatalogVariant.findFirst({
      where: {
        slug: slugs.variant,
        offerings: { some: {} },
        generation: {
          slug: slugs.generation,
          model: {
            slug: slugs.model,
            make: {
              slug: slugs.make,
              marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
              vehicleType: { in: PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES[slugs.segment] },
            },
          },
        },
      },
      include: VARIANT_PAGE_INCLUDE,
    });

    if (!variant) {
      throw new NotFoundException('No public catalog page at this address.');
    }

    return this.toVariantPage(variant, slugs.segment);
  }

  /**
   * Every publishable variant with its names, slugs and last change, in one
   * response. The build-time prerender walks it to decide which pages to write.
   */
  async getIndex(): Promise<PublicCatalogIndex> {
    const variants = await this.prisma.vehicleCatalogVariant.findMany({
      where: PUBLISHABLE_VARIANT_WHERE,
      orderBy: PUBLISHABLE_VARIANT_ORDER,
      select: {
        name: true,
        slug: true,
        updatedAt: true,
        offerings: { select: { updatedAt: true } },
        spec: { select: { updatedAt: true } },
        generation: {
          select: {
            name: true,
            slug: true,
            model: {
              select: {
                name: true,
                slug: true,
                make: { select: { name: true, slug: true, vehicleType: true } },
              },
            },
          },
        },
      },
    });

    const entries: PublicCatalogIndexEntry[] = [];
    for (const variant of variants) {
      const { generation } = variant;
      const { model } = generation;
      const { make } = model;
      const vehicleType = make.vehicleType as VehicleType;
      const segment = publicCatalogSegmentFor(vehicleType);
      if (!segment) continue;

      entries.push({
        segment,
        vehicleType,
        make: { name: make.name, slug: make.slug },
        model: { name: model.name, slug: model.slug },
        generation: { name: generation.name, slug: generation.slug },
        variant: { name: variant.name, slug: variant.slug },
        updatedAt: newest([
          variant.updatedAt,
          ...variant.offerings.map((offering) => offering.updatedAt),
          ...(variant.spec ? [variant.spec.updatedAt] : []),
        ]).toISOString(),
      });
    }

    return { variants: entries };
  }

  /**
   * Variant page payloads in bulk, a page at a time and in index order, each
   * exactly what `getVariantPage` returns for that variant's address. The
   * prerender reads the whole catalog this way in a handful of requests.
   */
  async getVariantPageBatch({
    page,
    pageSize,
  }: {
    page: number;
    pageSize: number;
  }): Promise<PublicCatalogVariantPageBatch> {
    const [total, variants] = await Promise.all([
      this.prisma.vehicleCatalogVariant.count({ where: PUBLISHABLE_VARIANT_WHERE }),
      this.prisma.vehicleCatalogVariant.findMany({
        where: PUBLISHABLE_VARIANT_WHERE,
        orderBy: PUBLISHABLE_VARIANT_ORDER,
        include: VARIANT_PAGE_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Each page resolves its own schedule, one small query apiece; Prisma's
    // connection pool bounds how many run at once.
    const items = await Promise.all(
      variants.flatMap((variant) => {
        const segment = publicCatalogSegmentFor(
          variant.generation.model.make.vehicleType as VehicleType,
        );
        return segment ? [this.toVariantPage(variant, segment)] : [];
      }),
    );

    return { items, page, pageSize, total, hasMore: page * pageSize < total };
  }

  private async toVariantPage(
    variant: VariantPageRow,
    segment: PublicCatalogSegment,
  ): Promise<PublicCatalogVariantPage> {
    const { generation } = variant;
    const { model } = generation;
    const { make } = model;
    const vehicleType = make.vehicleType as VehicleType;
    const offerings = sortOfferings(variant.offerings);
    const specs = variant.spec ? pickPublicSpec(variant.spec as unknown as SpecRow) : null;
    const fuelType = primaryFuelType(offerings);
    const schedule = await this.resolveSchedule(variant.id, vehicleType, fuelType);

    return {
      segment,
      vehicleType,
      make: { name: make.name, slug: make.slug },
      model: { name: model.name, slug: model.slug },
      generation: {
        name: generation.name,
        slug: generation.slug,
        yearStart: generation.yearStart,
        yearEnd: generation.yearEnd,
        isCurrent: generation.isCurrent,
      },
      variant: { name: variant.name, slug: variant.slug },
      offerings: offerings.map(toPublicOffering),
      specs,
      schedule,
      calculatorSeed: {
        fuelType,
        claimedMileage: fuelType === FuelType.Electric ? null : (specs?.mileageCombined ?? null),
        claimedRangeKm: fuelType === FuelType.Electric ? (specs?.rangeKm ?? null) : null,
        batteryKwh: specs?.batteryKwh ?? null,
      },
      updatedAt: newest([
        variant.updatedAt,
        ...variant.offerings.map((offering) => offering.updatedAt),
        ...(variant.spec ? [variant.spec.updatedAt] : []),
      ]).toISOString(),
    };
  }

  private async resolveSchedule(
    variantId: string,
    vehicleType: VehicleType,
    fuelType: FuelType,
  ): Promise<PublicCatalogSchedule> {
    const intervals = await this.intervalResolver.resolveForVariant({
      variantId,
      vehicleType,
      fuelType,
    });
    const items = Object.entries(intervals).map(([category, interval]) => ({
      category: category as MaintenanceCategory,
      km: interval.km,
      months: interval.months,
      source: interval.source,
    }));

    return {
      basis: items.some((item) => item.source === 'variant') ? 'variant' : 'typical',
      fuelType,
      vehicleType,
      items,
    };
  }
}

export function pickPublicSpec(row: SpecRow): PublicCatalogSpec {
  return Object.fromEntries(
    PUBLIC_SPEC_FIELDS.map((field) => [field, row[field] ?? null]),
  ) as unknown as PublicCatalogSpec;
}

/** Current offerings first, then the most recently ended, then the most recently started. */
function sortOfferings(offerings: OfferingRow[]): OfferingRow[] {
  return [...offerings].sort(
    (a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      (b.yearEnd ?? Infinity) - (a.yearEnd ?? Infinity) ||
      (b.yearStart ?? 0) - (a.yearStart ?? 0),
  );
}

/**
 * The fuel a variant's schedule and calculator are pitched at: the first fuel
 * of its newest offering. A petrol-and-CNG variant is treated as petrol; only a
 * variant sold as electric is treated as an EV.
 */
function primaryFuelType(sortedOfferings: OfferingRow[]): FuelType {
  const fuel = sortedOfferings[0]?.fuelTypes[0];
  return Object.values(FuelType).includes(fuel as FuelType) ? (fuel as FuelType) : FuelType.Petrol;
}

function toPublicOffering(offering: OfferingRow): PublicCatalogOffering {
  return {
    fuelTypes: offering.fuelTypes as FuelType[],
    yearStart: offering.yearStart,
    yearEnd: offering.yearEnd,
    isCurrent: offering.isCurrent,
  };
}

function newest(dates: Date[]): Date {
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}
