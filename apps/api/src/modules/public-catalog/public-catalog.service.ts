import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  buildPublicCatalogBrowsePage,
  buildPublicCatalogMakePage,
  DEFAULT_VEHICLE_CATALOG_MARKET,
  FuelType,
  PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES,
  publicCatalogSegmentFor,
  type MaintenanceCategory,
  type PublicCatalogBrowsePage,
  type PublicCatalogIndex,
  type PublicCatalogIndexEntry,
  type PublicCatalogMakePage,
  type PublicCatalogModelGeneration,
  type PublicCatalogModelPage,
  type PublicCatalogModelPageBatch,
  type PublicCatalogModelVariant,
  type PublicCatalogNamedSlug,
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
import {
  countFilledSpecFields,
  evaluateModelPageQuality,
  evaluateVariantPageQuality,
  type PageQuality,
} from './page-quality';

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
  generation: {
    include: {
      model: { include: { make: true } },
      // The page links the generation's other publishable variants.
      variants: {
        where: { offerings: { some: {} } },
        select: { name: true, slug: true },
        orderBy: { name: 'asc' },
      },
    },
  },
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

export type PublicMakeSlugs = {
  segment: PublicCatalogSegment;
  make: string;
};

export type PublicModelSlugs = {
  segment: PublicCatalogSegment;
  make: string;
  model: string;
};

/** A publishable variant row with what a model page reads from it, worked out once. */
type ModelPageVariant = {
  row: VariantPageRow;
  /** Newest first, as a variant page lists them. */
  offerings: OfferingRow[];
  specs: PublicCatalogSpec | null;
  fuelType: FuelType;
  quality: PageQuality;
  updatedAt: Date;
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
   * Every publishable variant with its names, slugs, last change and the
   * page-quality gate's verdict, in one response. The build-time prerender
   * walks it to decide which pages to write and which go in the sitemap.
   */
  async getIndex(): Promise<PublicCatalogIndex> {
    return { variants: await this.indexEntries(PUBLISHABLE_VARIANT_WHERE) };
  }

  /**
   * The browse page at `/{segment}`: every make with a public page there. Built
   * from the segment's index entries by the same function the web build's
   * prerender runs over the whole index, so the two cannot disagree.
   */
  async getBrowsePage(segment: PublicCatalogSegment): Promise<PublicCatalogBrowsePage> {
    const entries = await this.indexEntries({
      ...PUBLISHABLE_VARIANT_WHERE,
      generation: {
        model: {
          make: {
            marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
            vehicleType: { in: PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES[segment] },
          },
        },
      },
    });
    return buildPublicCatalogBrowsePage(entries, segment);
  }

  /**
   * The make page at `/{segment}/{make}`: its models, from every make row with
   * that slug in the segment (Hyundai is a car and an SUV make with one slug).
   */
  async getMakePage(slugs: PublicMakeSlugs): Promise<PublicCatalogMakePage> {
    const entries = await this.indexEntries({
      ...PUBLISHABLE_VARIANT_WHERE,
      generation: {
        model: {
          make: {
            slug: slugs.make,
            marketCode: DEFAULT_VEHICLE_CATALOG_MARKET,
            vehicleType: { in: PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES[slugs.segment] },
          },
        },
      },
    });
    const page = buildPublicCatalogMakePage(entries, slugs.segment, slugs.make);
    if (!page) {
      throw new NotFoundException('No public catalog page at this address.');
    }
    return page;
  }

  /** Index entries for the publishable variants `where` picks, in index order. */
  private async indexEntries(
    where: Prisma.VehicleCatalogVariantWhereInput,
  ): Promise<PublicCatalogIndexEntry[]> {
    const variants = await this.prisma.vehicleCatalogVariant.findMany({
      where,
      orderBy: PUBLISHABLE_VARIANT_ORDER,
      select: {
        name: true,
        slug: true,
        updatedAt: true,
        offerings: {
          select: {
            fuelTypes: true,
            yearStart: true,
            yearEnd: true,
            isCurrent: true,
            updatedAt: true,
          },
        },
        // The whole row, for the page-quality gate; only the allow-listed
        // fields are read from it, and none of it goes into the entry.
        spec: true,
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

      const specs = variant.spec ? pickPublicSpec(variant.spec as unknown as SpecRow) : null;
      const offerings = sortOfferings(variant.offerings);
      const fuelType = primaryFuelType(offerings);

      entries.push({
        segment,
        vehicleType,
        make: { name: make.name, slug: make.slug },
        model: { name: model.name, slug: model.slug },
        generation: { name: generation.name, slug: generation.slug },
        variant: { name: variant.name, slug: variant.slug },
        ...offeringSpan(offerings),
        indexable: evaluateVariantPageQuality({ fuelType, specs }).indexable,
        updatedAt: newest([
          variant.updatedAt,
          ...variant.offerings.map((offering) => offering.updatedAt),
          ...(variant.spec ? [variant.spec.updatedAt] : []),
        ]).toISOString(),
      });
    }

    return entries;
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

  /**
   * The model page at `/{segment}/{make}/{model}`: every publishable variant at
   * that address, whichever make row it hangs off. Hyundai is both a car and an
   * SUV make with one slug, and a page is an address, not a row.
   */
  async getModelPage(slugs: PublicModelSlugs): Promise<PublicCatalogModelPage> {
    const variants = await this.prisma.vehicleCatalogVariant.findMany({
      where: {
        offerings: { some: {} },
        generation: {
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
      orderBy: PUBLISHABLE_VARIANT_ORDER,
      include: VARIANT_PAGE_INCLUDE,
    });

    if (variants.length === 0) {
      throw new NotFoundException('No public catalog page at this address.');
    }

    return this.toModelPage(variants, slugs.segment);
  }

  /**
   * Model page payloads in bulk, a page of addresses at a time, ordered by
   * address. Each is exactly what `getModelPage` returns for that address, so
   * the prerender reads every model page in a few requests.
   */
  async getModelPageBatch({
    page,
    pageSize,
  }: {
    page: number;
    pageSize: number;
  }): Promise<PublicCatalogModelPageBatch> {
    const models = await this.prisma.vehicleCatalogModel.findMany({
      where: {
        make: PUBLISHABLE_VARIANT_WHERE.generation.model.make,
        generations: { some: { variants: { some: { offerings: { some: {} } } } } },
      },
      select: { id: true, slug: true, make: { select: { slug: true, vehicleType: true } } },
    });

    // One address can span model rows under more than one make row.
    const addresses = new Map<
      string,
      { segment: PublicCatalogSegment; make: string; model: string; modelIds: string[] }
    >();
    for (const model of models) {
      const segment = publicCatalogSegmentFor(model.make.vehicleType as VehicleType);
      if (!segment) continue;
      const key = modelAddressKey(segment, model.make.slug, model.slug);
      const address = addresses.get(key) ?? {
        segment,
        make: model.make.slug,
        model: model.slug,
        modelIds: [],
      };
      address.modelIds.push(model.id);
      addresses.set(key, address);
    }

    const ordered = [...addresses.values()].sort(
      (a, b) =>
        compareText(a.segment, b.segment) ||
        compareText(a.make, b.make) ||
        compareText(a.model, b.model),
    );
    const onPage = ordered.slice((page - 1) * pageSize, page * pageSize);
    const variants =
      onPage.length === 0
        ? []
        : await this.prisma.vehicleCatalogVariant.findMany({
            where: {
              offerings: { some: {} },
              generation: { modelId: { in: onPage.flatMap((address) => address.modelIds) } },
            },
            orderBy: PUBLISHABLE_VARIANT_ORDER,
            include: VARIANT_PAGE_INCLUDE,
          });

    const variantsByAddress = new Map<string, VariantPageRow[]>();
    for (const variant of variants) {
      const { model } = variant.generation;
      const segment = publicCatalogSegmentFor(model.make.vehicleType as VehicleType);
      if (!segment) continue;
      const key = modelAddressKey(segment, model.make.slug, model.slug);
      variantsByAddress.set(key, [...(variantsByAddress.get(key) ?? []), variant]);
    }

    // Each page resolves one schedule, its representative's.
    const items = await Promise.all(
      onPage.flatMap((address) => {
        const rows = variantsByAddress.get(
          modelAddressKey(address.segment, address.make, address.model),
        );
        return rows ? [this.toModelPage(rows, address.segment)] : [];
      }),
    );

    return {
      items,
      page,
      pageSize,
      total: ordered.length,
      hasMore: page * pageSize < ordered.length,
    };
  }

  /**
   * One model page from its publishable variant rows, in `id` order. A
   * generation or variant slug seen twice at one address (the same model under
   * two make rows) is listed once, the first row winning — the same row the
   * prerender keeps when two index entries share a variant address.
   */
  private async toModelPage(
    rows: VariantPageRow[],
    segment: PublicCatalogSegment,
  ): Promise<PublicCatalogModelPage> {
    const generations = new Map<
      string,
      Omit<PublicCatalogModelGeneration, 'variants'> & {
        variants: Map<string, ModelPageVariant>;
      }
    >();

    for (const row of rows) {
      const { generation } = row;
      const group = generations.get(generation.slug) ?? {
        name: generation.name,
        slug: generation.slug,
        yearStart: generation.yearStart,
        yearEnd: generation.yearEnd,
        isCurrent: generation.isCurrent,
        variants: new Map<string, ModelPageVariant>(),
      };
      generations.set(generation.slug, group);
      if (group.variants.has(row.slug)) continue;

      const offerings = sortOfferings(row.offerings);
      const specs = row.spec ? pickPublicSpec(row.spec as unknown as SpecRow) : null;
      const fuelType = primaryFuelType(offerings);
      group.variants.set(row.slug, {
        row,
        offerings,
        specs,
        fuelType,
        quality: evaluateVariantPageQuality({ fuelType, specs }),
        updatedAt: newest([
          row.updatedAt,
          ...row.offerings.map((offering) => offering.updatedAt),
          ...(row.spec ? [row.spec.updatedAt] : []),
        ]),
      });
    }

    const listed = [...generations.values()].flatMap((group) => [...group.variants.values()]);
    const representative = [...listed].sort(compareRepresentatives)[0];
    if (!representative) {
      throw new NotFoundException('No public catalog page at this address.');
    }
    const { generation } = representative.row;
    const { model } = generation;
    const { make } = model;
    const vehicleType = make.vehicleType as VehicleType;

    return {
      segment,
      vehicleType,
      make: { name: make.name, slug: make.slug },
      model: { name: model.name, slug: model.slug },
      generations: [...generations.values()]
        .map(({ variants, ...group }) => ({
          ...group,
          variants: [...variants.values()].map(toModelVariant).sort(compareModelVariants),
        }))
        .sort(compareGenerations),
      representative: {
        generation: { name: generation.name, slug: generation.slug },
        variant: { name: representative.row.name, slug: representative.row.slug },
        specs: representative.specs,
      },
      schedule: await this.resolveSchedule(
        representative.row.id,
        vehicleType,
        representative.fuelType,
      ),
      indexable: evaluateModelPageQuality(listed.map((variant) => variant.quality)).indexable,
      updatedAt: newest(listed.map((variant) => variant.updatedAt)).toISOString(),
    };
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
      siblings: generation.variants
        .filter((sibling) => sibling.slug !== variant.slug)
        .map((sibling) => ({ name: sibling.name, slug: sibling.slug })),
      offerings: offerings.map(toPublicOffering),
      specs,
      schedule,
      calculatorSeed: {
        fuelType,
        claimedMileage: fuelType === FuelType.Electric ? null : (specs?.mileageCombined ?? null),
        claimedRangeKm: fuelType === FuelType.Electric ? (specs?.rangeKm ?? null) : null,
        batteryKwh: specs?.batteryKwh ?? null,
      },
      indexable: evaluateVariantPageQuality({ fuelType, specs }).indexable,
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

function modelAddressKey(segment: PublicCatalogSegment, make: string, model: string) {
  return `${segment}/${make}/${model}`;
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Names as a person sorts them: "VX" before "ZX", "Series 2" before "Series 10". */
function compareNames(a: PublicCatalogNamedSlug, b: PublicCatalogNamedSlug) {
  return (
    a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) ||
    compareText(a.slug, b.slug)
  );
}

/** Current first, then the most recently ended (or never ended), then the most recently started. */
function compareGenerations(a: PublicCatalogModelGeneration, b: PublicCatalogModelGeneration) {
  return (
    Number(b.isCurrent) - Number(a.isCurrent) ||
    (b.yearEnd ?? Infinity) - (a.yearEnd ?? Infinity) ||
    (b.yearStart ?? 0) - (a.yearStart ?? 0) ||
    compareNames(a, b)
  );
}

/** Within a generation: on sale first, then by name. */
function compareModelVariants(a: PublicCatalogModelVariant, b: PublicCatalogModelVariant) {
  return Number(b.isCurrent) - Number(a.isCurrent) || compareNames(a, b);
}

/**
 * Which variant speaks for the model: one in the current generation, on sale
 * now, that the page-quality gate passes (so its specs say something), with
 * the newest offering, then the most facts; the name settles a tie.
 */
function compareRepresentatives(a: ModelPageVariant, b: ModelPageVariant) {
  return (
    Number(b.row.generation.isCurrent) - Number(a.row.generation.isCurrent) ||
    Number(isOnSale(b)) - Number(isOnSale(a)) ||
    Number(b.quality.indexable) - Number(a.quality.indexable) ||
    (b.offerings[0]?.yearStart ?? 0) - (a.offerings[0]?.yearStart ?? 0) ||
    (b.specs ? countFilledSpecFields(b.specs) : 0) -
      (a.specs ? countFilledSpecFields(a.specs) : 0) ||
    compareNames(a.row, b.row)
  );
}

function isOnSale(variant: ModelPageVariant) {
  return variant.offerings.some((offering) => offering.isCurrent);
}

function toModelVariant(variant: ModelPageVariant): PublicCatalogModelVariant {
  return {
    name: variant.row.name,
    slug: variant.row.slug,
    ...offeringSpan(variant.offerings),
    transmission: variant.specs?.transmission ?? null,
  };
}

/**
 * What a variant's offerings add up to, newest first: its fuels (the newest
 * offering's first), its first and last years, and whether it is on sale. A
 * model page's variant list and each index entry say the same.
 */
function offeringSpan(sortedOfferings: OfferingRow[]) {
  const isCurrent = sortedOfferings.some((offering) => offering.isCurrent);
  const starts = sortedOfferings.flatMap((offering) => offering.yearStart ?? []);
  const ends = sortedOfferings.flatMap((offering) => offering.yearEnd ?? []);

  return {
    fuelTypes: [
      ...new Set(sortedOfferings.flatMap((offering) => offering.fuelTypes)),
    ] as FuelType[],
    yearStart: starts.length > 0 ? Math.min(...starts) : null,
    yearEnd: isCurrent || ends.length === 0 ? null : Math.max(...ends),
    isCurrent,
  };
}
