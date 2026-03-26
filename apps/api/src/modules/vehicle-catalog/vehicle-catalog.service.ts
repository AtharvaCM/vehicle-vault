import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FuelType,
  type UpdateVehicleCatalogOfferingReviewInput,
  VehicleCatalogImportDatasetSchema,
  VehicleCatalogMarket,
  VehicleType,
  type AuthUser,
  type VehicleCatalogImportDataset,
  type VehicleCatalogImportRunDetail,
  type VehicleCatalogImportRunReview,
  type VehicleCatalogMakeOption,
  type VehicleCatalogMakeQuery,
  type VehicleCatalogModelOption,
  type VehicleCatalogModelQuery,
  type VehicleCatalogPublishedOfferingReview,
  type VehicleCatalogVariantOption,
  type VehicleCatalogVariantQuery,
} from '@vehicle-vault/shared';

import { upsertCatalogDataset } from '../../../prisma/catalog-import/upsert-catalog-dataset';
import { syncCatalogAliases } from '../../../prisma/catalog-import/sync-catalog-aliases';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListVehicleCatalogMakesDto } from './dto/list-vehicle-catalog-makes.dto';
import { ListVehicleCatalogModelsDto } from './dto/list-vehicle-catalog-models.dto';
import { ListVehicleCatalogVariantsDto } from './dto/list-vehicle-catalog-variants.dto';

type ImportRunRecord = {
  id: string;
  sourceKey: string;
  marketCode: string;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  snapshotCount: number;
  recordsUpserted: number;
  notes: string | null;
  publishedAt: Date | null;
  publishedByUserId: string | null;
  snapshots: Array<{
    capturedAt: Date;
    payload: unknown;
  }>;
};

type PublishedOfferingRecord = {
  id: string;
  fuelTypes: string[];
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
  sourceName: string | null;
  sourceUrl: string | null;
  variantId: string;
  variant: {
    name: string;
    sourceUrl: string | null;
    generation: {
      name: string;
      yearStart: number | null;
      yearEnd: number | null;
      isCurrent: boolean;
      sourceUrl: string | null;
      model: {
        name: string;
        sourceUrl: string | null;
        make: {
          name: string;
          marketCode: string;
          vehicleType: string;
          sourceUrl: string | null;
        };
      };
    };
  };
};

type OfferingOverrideRecord = {
  variantId: string;
  sourceName: string;
  fuelTypeSignature: string;
  reviewNote: string | null;
  manualYearStart: number | null;
  manualYearEnd: number | null;
  manualIsCurrent: boolean | null;
};

type CatalogMakeRecord = VehicleCatalogImportDataset[number];
type CatalogModelRecord = CatalogMakeRecord['models'][number];
type CatalogGenerationRecord = CatalogModelRecord['generations'][number];
type CatalogVariantRecord = CatalogGenerationRecord['variants'][number];

type CatalogCounts = {
  makes: number;
  models: number;
  generations: number;
  variants: number;
  offerings: number;
};

type NormalizedCatalogSummary = {
  counts: CatalogCounts;
  modelKeys: Set<string>;
  modelLabels: Map<string, string>;
  variantKeys: Set<string>;
  variantLabels: Map<string, string>;
  variantOfferingSignatures: Map<string, string[]>;
};

@Injectable()
export class VehicleCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getVariantSpecs(variantId: string) {
    const spec = await this.prisma.vehicleCatalogVariantSpec.findUnique({
      where: { variantId },
    });

    if (!spec) {
      throw new NotFoundException(`No specs found for variant ${variantId}`);
    }

    return spec;
  }

  async findVariantSpecsByName(make: string, model: string, variant: string) {
    const catalogVariant = await this.prisma.vehicleCatalogVariant.findFirst({
      where: {
        name: { equals: variant, mode: 'insensitive' },
        generation: {
          model: {
            name: { equals: model, mode: 'insensitive' },
            make: {
              name: { equals: make, mode: 'insensitive' },
            },
          },
        },
      },
      include: { spec: true },
    });

    if (!catalogVariant?.spec) {
      return null;
    }

    return catalogVariant.spec;
  }

  async listMakes(query: ListVehicleCatalogMakesDto): Promise<VehicleCatalogMakeOption[]> {
    const normalized = normalizeMakeQuery(query);
    const makes = await this.prisma.vehicleCatalogMake.findMany({
      include: {
        aliases: {
          select: {
            alias: true,
          },
        },
      },
      where: {
        marketCode: normalized.marketCode,
        vehicleType: normalized.vehicleType,
        ...buildMakeSearchWhere(normalized.query),
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
      keywords: uniqueKeywords(make.aliases.map((alias) => alias.alias)),
      marketCode: make.marketCode as VehicleCatalogMarket,
      vehicleType: make.vehicleType as VehicleType,
      name: make.name,
    }));
  }

  async listModels(query: ListVehicleCatalogModelsDto): Promise<VehicleCatalogModelOption[]> {
    const normalized = normalizeModelQuery(query);
    const models = await this.prisma.vehicleCatalogModel.findMany({
      include: {
        aliases: {
          select: {
            alias: true,
          },
        },
        generations: {
          include: {
            aliases: {
              select: {
                alias: true,
              },
            },
            variants: {
              include: {
                aliases: {
                  select: {
                    alias: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        make: {
          marketCode: normalized.marketCode,
          vehicleType: normalized.vehicleType,
          name: normalized.make,
        },
        ...buildModelSearchWhere(normalized.query),
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
      keywords: buildModelKeywords(model),
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
        ...buildVariantSearchWhere(normalized.query),
        ...(normalized.year !== undefined
          ? {
              offerings: {
                some: buildOfferingYearWhere(normalized.year),
              },
            }
          : {}),
      },
      include: {
        aliases: {
          select: {
            alias: true,
          },
        },
        generation: {
          include: {
            aliases: {
              select: {
                alias: true,
              },
            },
            model: {
              select: {
                name: true,
              },
            },
          },
        },
        offerings: {
          where:
            normalized.year !== undefined ? buildOfferingYearWhere(normalized.year) : undefined,
          orderBy: [{ isCurrent: 'desc' }, { yearEnd: 'desc' }, { yearStart: 'desc' }],
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return collapseVariantOptions(
      variants.map((variant) => ({
        id: variant.id,
        keywords: buildVariantKeywords(variant),
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

  async listImportRuns(): Promise<VehicleCatalogImportRunReview[]> {
    const runs = await this.prisma.vehicleCatalogImportRun.findMany({
      include: {
        snapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 10,
    });

    return Promise.all(runs.map((run) => this.mapImportRunReview(run)));
  }

  async getImportRunDetail(runId: string): Promise<VehicleCatalogImportRunDetail> {
    const run = await this.prisma.vehicleCatalogImportRun.findUnique({
      where: {
        id: runId,
      },
      include: {
        snapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Catalog import run ${runId} was not found`);
    }

    return this.mapImportRunDetail(run);
  }

  async updateOfferingReview(
    user: AuthUser,
    offeringId: string,
    input: UpdateVehicleCatalogOfferingReviewInput,
  ): Promise<VehicleCatalogPublishedOfferingReview> {
    const offering = await this.prisma.vehicleCatalogVariantOffering.findUnique({
      where: {
        id: offeringId,
      },
      include: {
        variant: {
          include: {
            generation: {
              include: {
                model: {
                  include: {
                    make: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!offering) {
      throw new NotFoundException(`Catalog offering ${offeringId} was not found`);
    }

    if (!offering.sourceName) {
      throw new BadRequestException(
        'Only source-backed catalog offerings can be manually reviewed.',
      );
    }

    const sourceName = offering.sourceName;

    if (
      !user.allowedCatalogSources.includes(sourceName) &&
      !user.allowedCatalogSources.includes('*')
    ) {
      throw new ForbiddenException('You do not have permission to review this source.');
    }

    const nextYearStart =
      input.yearStart !== undefined ? (input.yearStart ?? null) : offering.yearStart;
    const nextYearEnd = input.yearEnd !== undefined ? (input.yearEnd ?? null) : offering.yearEnd;
    const nextIsCurrent = input.isCurrent !== undefined ? input.isCurrent : offering.isCurrent;
    const fuelTypeSignature = buildFuelTypeSignature(offering.fuelTypes as FuelType[]);

    if (nextYearStart !== null && nextYearEnd !== null && nextYearEnd < nextYearStart) {
      throw new BadRequestException('End year cannot be earlier than start year.');
    }

    const updatedOffering = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicleCatalogVariantOffering.update({
        where: {
          id: offering.id,
        },
        data: {
          yearStart: nextYearStart,
          yearEnd: nextYearEnd,
          isCurrent: nextIsCurrent,
        },
        include: {
          variant: {
            include: {
              generation: {
                include: {
                  model: {
                    include: {
                      make: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      await tx.vehicleCatalogVariantOfferingOverride.upsert({
        where: {
          variantId_sourceName_fuelTypeSignature: {
            variantId: offering.variantId,
            sourceName,
            fuelTypeSignature,
          },
        },
        update: {
          reviewNote: input.reviewNote !== undefined ? (input.reviewNote ?? null) : undefined,
          manualYearStart: nextYearStart,
          manualYearEnd: nextYearEnd,
          manualIsCurrent: nextIsCurrent,
        },
        create: {
          variantId: offering.variantId,
          sourceName,
          fuelTypeSignature,
          reviewNote: input.reviewNote ?? null,
          manualYearStart: nextYearStart,
          manualYearEnd: nextYearEnd,
          manualIsCurrent: nextIsCurrent,
        },
      });

      return updated;
    });

    return this.mapPublishedOfferingReview(updatedOffering, {
      reviewNote: input.reviewNote !== undefined ? (input.reviewNote ?? null) : null,
      manualYearStart: nextYearStart,
      manualYearEnd: nextYearEnd,
      manualIsCurrent: nextIsCurrent,
    });
  }

  async publishImportRun(user: AuthUser, runId: string): Promise<VehicleCatalogImportRunReview> {
    const run = await this.prisma.vehicleCatalogImportRun.findUnique({
      where: {
        id: runId,
      },
      include: {
        snapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Catalog import run ${runId} was not found`);
    }

    if (run.status !== 'succeeded') {
      throw new BadRequestException('Only successful import runs can be published.');
    }

    if (
      !user.allowedCatalogSources.includes(run.sourceKey) &&
      !user.allowedCatalogSources.includes('*')
    ) {
      throw new ForbiddenException('You do not have permission to publish this import run.');
    }

    if (run.publishedAt) {
      throw new BadRequestException('This import run has already been published.');
    }

    const newerRun = await this.prisma.vehicleCatalogImportRun.findFirst({
      where: {
        sourceKey: run.sourceKey,
        marketCode: run.marketCode,
        status: 'succeeded',
        startedAt: {
          gt: run.startedAt,
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (newerRun) {
      throw new BadRequestException(
        'A newer successful import run exists for this source. Review the latest run before publishing.',
      );
    }

    const snapshot = run.snapshots[0];

    if (!snapshot) {
      throw new BadRequestException('This import run has no stored snapshot to publish.');
    }

    const dataset = parseImportDataset(snapshot.payload);

    const updatedRun = await this.prisma.$transaction(async (tx) => {
      const recordsUpserted = await upsertCatalogDataset(tx, dataset, {
        defaultSourceName: run.sourceKey,
      });
      await syncCatalogAliases(tx);

      return tx.vehicleCatalogImportRun.update({
        where: {
          id: run.id,
        },
        data: {
          publishedAt: new Date(),
          publishedByUserId: user.id,
          recordsUpserted,
        },
        include: {
          snapshots: {
            orderBy: {
              capturedAt: 'desc',
            },
            take: 1,
          },
        },
      });
    });

    return this.mapImportRunReview(updatedRun, dataset);
  }

  async archiveMissingVariants(
    user: AuthUser,
    runId: string,
  ): Promise<VehicleCatalogImportRunReview> {
    const run = await this.prisma.vehicleCatalogImportRun.findUnique({
      where: {
        id: runId,
      },
      include: {
        snapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Catalog import run ${runId} was not found`);
    }

    if (run.status !== 'succeeded') {
      throw new BadRequestException('Only successful import runs can archive missing variants.');
    }

    if (
      !user.allowedCatalogSources.includes(run.sourceKey) &&
      !user.allowedCatalogSources.includes('*')
    ) {
      throw new ForbiddenException(
        'You do not have permission to archive missing variants for this import run.',
      );
    }

    if (run.publishedAt) {
      throw new BadRequestException('Archive missing variants before publishing this import run.');
    }

    const snapshot = run.snapshots[0];

    if (!snapshot) {
      throw new BadRequestException('This import run has no stored snapshot to review.');
    }

    const dataset = parseImportDataset(snapshot.payload);
    const incomingSummary = summarizeImportDataset(dataset);
    const activeOfferings = await this.getActivePublishedSourceOfferings(
      run.marketCode,
      run.sourceKey,
    );
    const missingVariantOfferingIds = new Set<string>();

    for (const offering of activeOfferings) {
      const variantKey = buildPublishedVariantKey(offering);

      if (!incomingSummary.variantKeys.has(variantKey)) {
        missingVariantOfferingIds.add(offering.id);
      }
    }

    if (missingVariantOfferingIds.size === 0) {
      return this.mapImportRunReview(run, dataset);
    }

    const archiveYear = new Date().getFullYear();
    const offeringIds = [...missingVariantOfferingIds];

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicleCatalogVariantOffering.updateMany({
        where: {
          id: {
            in: offeringIds,
          },
          yearEnd: null,
        },
        data: {
          isCurrent: false,
          yearEnd: archiveYear,
        },
      });

      await tx.vehicleCatalogVariantOffering.updateMany({
        where: {
          id: {
            in: offeringIds,
          },
          NOT: {
            yearEnd: null,
          },
        },
        data: {
          isCurrent: false,
        },
      });
    });

    const refreshedRun = await this.prisma.vehicleCatalogImportRun.findUnique({
      where: {
        id: run.id,
      },
      include: {
        snapshots: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!refreshedRun) {
      throw new NotFoundException(`Catalog import run ${runId} was not found after archiving.`);
    }

    return this.mapImportRunReview(refreshedRun, dataset);
  }

  private async mapImportRunReview(
    run: ImportRunRecord,
    datasetOverride?: VehicleCatalogImportDataset,
  ): Promise<VehicleCatalogImportRunReview> {
    const snapshot = run.snapshots[0];
    const dataset = datasetOverride ?? parseImportDataset(snapshot?.payload);
    const currentPublishedDataset = await this.getPublishedSourceDataset(
      run.marketCode,
      run.sourceKey,
    );

    return {
      id: run.id,
      sourceKey: run.sourceKey,
      marketCode: run.marketCode,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      snapshotCapturedAt: snapshot?.capturedAt.toISOString(),
      snapshotCount: run.snapshotCount,
      publishedAt: run.publishedAt?.toISOString(),
      publishedByUserId: run.publishedByUserId ?? undefined,
      recordsUpserted: run.recordsUpserted,
      notes: run.notes ?? undefined,
      diff: buildImportDiff(dataset, currentPublishedDataset),
    };
  }

  private async mapImportRunDetail(run: ImportRunRecord): Promise<VehicleCatalogImportRunDetail> {
    const snapshot = run.snapshots[0];
    const dataset = parseImportDataset(snapshot?.payload);
    const review = await this.mapImportRunReview(run, dataset);
    const publishedOfferings = await this.getPublishedOfferingReviews(
      run.marketCode,
      run.sourceKey,
    );

    return {
      ...review,
      dataset,
      publishedOfferings,
    };
  }

  private async getPublishedOfferingReviews(
    marketCode: string,
    sourceKey: string,
  ): Promise<VehicleCatalogPublishedOfferingReview[]> {
    const offerings = await this.getActivePublishedSourceOfferings(marketCode, sourceKey);

    if (!offerings.length) {
      return [];
    }

    const overrideRows = await this.prisma.vehicleCatalogVariantOfferingOverride.findMany({
      where: {
        sourceName: sourceKey,
        OR: offerings.map((offering) => ({
          variantId: offering.variantId,
          fuelTypeSignature: buildFuelTypeSignature(offering.fuelTypes),
        })),
      },
    });

    const overridesByKey = new Map(
      overrideRows.map((override) => [buildOverrideKey(override), override]),
    );

    return offerings.map((offering) =>
      this.mapPublishedOfferingReview(
        offering,
        overridesByKey.get(
          buildOverrideKey({
            variantId: offering.variantId,
            sourceName: sourceKey,
            fuelTypeSignature: buildFuelTypeSignature(offering.fuelTypes),
          }),
        ),
      ),
    );
  }

  private async getPublishedSourceDataset(
    marketCode: string,
    sourceKey: string,
  ): Promise<VehicleCatalogImportDataset> {
    const offerings = await this.getActivePublishedSourceOfferings(marketCode, sourceKey);

    const makeMap = new Map<string, VehicleCatalogImportDataset[number]>();

    for (const offering of offerings) {
      const generation = offering.variant.generation;
      const model = generation.model;
      const make = model.make;
      const makeKey = `${make.marketCode}|${make.vehicleType}|${normalizeKey(make.name)}`;

      const makeRecord: CatalogMakeRecord = makeMap.get(makeKey) ?? {
        marketCode: make.marketCode,
        vehicleType: make.vehicleType as VehicleType,
        name: make.name,
        sourceUrl: make.sourceUrl ?? undefined,
        models: [],
      };

      let modelRecord: CatalogModelRecord | undefined = makeRecord.models.find(
        (entry) => normalizeKey(entry.name) === normalizeKey(model.name),
      );

      if (!modelRecord) {
        modelRecord = {
          name: model.name,
          sourceUrl: model.sourceUrl ?? undefined,
          generations: [],
        };
        makeRecord.models.push(modelRecord);
      }

      let generationRecord: CatalogGenerationRecord | undefined = modelRecord.generations.find(
        (entry) => normalizeKey(entry.name) === normalizeKey(generation.name),
      );

      if (!generationRecord) {
        generationRecord = {
          name: generation.name,
          yearStart: generation.yearStart ?? undefined,
          yearEnd: generation.yearEnd ?? undefined,
          isCurrent: generation.isCurrent,
          sourceUrl: generation.sourceUrl ?? undefined,
          variants: [],
        };
        modelRecord.generations.push(generationRecord);
      }

      let variantRecord: CatalogVariantRecord | undefined = generationRecord.variants.find(
        (entry) => normalizeKey(entry.name) === normalizeKey(offering.variant.name),
      );

      if (!variantRecord) {
        variantRecord = {
          name: offering.variant.name,
          sourceUrl: offering.variant.sourceUrl ?? undefined,
          offerings: [],
        };
        generationRecord.variants.push(variantRecord);
      }

      if (
        !variantRecord.offerings.some(
          (entry) =>
            buildOfferingSignature(entry) ===
            buildOfferingSignature({
              fuelTypes: offering.fuelTypes as FuelType[],
              yearStart: offering.yearStart ?? undefined,
              yearEnd: offering.yearEnd ?? undefined,
              isCurrent: offering.isCurrent,
              sourceUrl: offering.sourceUrl ?? undefined,
            }),
        )
      ) {
        variantRecord.offerings.push({
          fuelTypes: offering.fuelTypes as FuelType[],
          yearStart: offering.yearStart ?? undefined,
          yearEnd: offering.yearEnd ?? undefined,
          isCurrent: offering.isCurrent,
          sourceUrl: offering.sourceUrl ?? undefined,
        });
      }

      makeMap.set(makeKey, makeRecord);
    }

    return [...makeMap.values()].sort(compareImportMakes);
  }

  private async getActivePublishedSourceOfferings(
    marketCode: string,
    sourceKey: string,
  ): Promise<PublishedOfferingRecord[]> {
    return this.prisma.vehicleCatalogVariantOffering.findMany({
      where: {
        sourceName: sourceKey,
        isCurrent: true,
        variant: {
          generation: {
            model: {
              make: {
                marketCode,
              },
            },
          },
        },
      },
      include: {
        variant: {
          include: {
            generation: {
              include: {
                model: {
                  include: {
                    make: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        {
          variant: {
            generation: {
              model: {
                make: {
                  name: 'asc',
                },
              },
            },
          },
        },
      ],
    });
  }

  private mapPublishedOfferingReview(
    offering: PublishedOfferingRecord,
    override?: Pick<
      OfferingOverrideRecord,
      'reviewNote' | 'manualYearStart' | 'manualYearEnd' | 'manualIsCurrent'
    >,
  ): VehicleCatalogPublishedOfferingReview {
    return {
      id: offering.id,
      makeName: offering.variant.generation.model.make.name,
      modelName: offering.variant.generation.model.name,
      generationName: offering.variant.generation.name,
      variantName: offering.variant.name,
      fuelTypes: [...offering.fuelTypes].sort() as FuelType[],
      yearStart: offering.yearStart ?? undefined,
      yearEnd: offering.yearEnd ?? undefined,
      isCurrent: offering.isCurrent,
      sourceUrl: offering.sourceUrl ?? undefined,
      reviewNote: override?.reviewNote ?? undefined,
      manualOverrideApplied: Boolean(override),
    };
  }
}

function buildModelKeywords(model: {
  aliases: Array<{ alias: string }>;
  generations: Array<{
    name: string;
    aliases: Array<{ alias: string }>;
    variants: Array<{
      name: string;
      aliases: Array<{ alias: string }>;
    }>;
  }>;
}) {
  return uniqueKeywords([
    ...model.aliases.map((alias) => alias.alias),
    ...model.generations.flatMap((generation) => [
      generation.name,
      ...generation.aliases.map((alias) => alias.alias),
      ...generation.variants.flatMap((variant) => [
        variant.name,
        ...variant.aliases.map((alias) => alias.alias),
      ]),
    ]),
  ]);
}

function buildMakeSearchWhere(query?: string) {
  if (!query) {
    return {};
  }

  return {
    OR: [
      {
        name: {
          contains: query,
          mode: 'insensitive' as const,
        },
      },
      {
        aliases: {
          some: {
            alias: {
              contains: query,
              mode: 'insensitive' as const,
            },
          },
        },
      },
    ],
  };
}

function buildModelSearchWhere(query?: string) {
  if (!query) {
    return {};
  }

  return {
    OR: [
      {
        name: {
          contains: query,
          mode: 'insensitive' as const,
        },
      },
      {
        aliases: {
          some: {
            alias: {
              contains: query,
              mode: 'insensitive' as const,
            },
          },
        },
      },
      {
        generations: {
          some: {
            name: {
              contains: query,
              mode: 'insensitive' as const,
            },
          },
        },
      },
      {
        generations: {
          some: {
            aliases: {
              some: {
                alias: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        },
      },
      {
        generations: {
          some: {
            variants: {
              some: {
                name: {
                  contains: query,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        },
      },
      {
        generations: {
          some: {
            variants: {
              some: {
                aliases: {
                  some: {
                    alias: {
                      contains: query,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  };
}

function buildVariantSearchWhere(query?: string) {
  if (!query) {
    return {};
  }

  return {
    OR: [
      {
        name: {
          contains: query,
          mode: 'insensitive' as const,
        },
      },
      {
        aliases: {
          some: {
            alias: {
              contains: query,
              mode: 'insensitive' as const,
            },
          },
        },
      },
      {
        generation: {
          name: {
            contains: query,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        generation: {
          aliases: {
            some: {
              alias: {
                contains: query,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      },
    ],
  };
}

function buildVariantKeywords(variant: {
  aliases: Array<{ alias: string }>;
  generation: {
    name: string;
    aliases: Array<{ alias: string }>;
    model: {
      name: string;
    };
  };
}) {
  return uniqueKeywords([
    variant.generation.model.name,
    variant.generation.name,
    ...variant.aliases.map((alias) => alias.alias),
    ...variant.generation.aliases.map((alias) => alias.alias),
  ]);
}

function uniqueKeywords(values: string[]) {
  const normalized = new Set<string>();
  const keywords: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();

    if (normalized.has(key)) {
      continue;
    }

    normalized.add(key);
    keywords.push(trimmed);
  }

  return keywords;
}

function collapseVariantOptions(
  variants: Array<{
    id: string;
    keywords?: string[];
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
      keywords: Set<string>;
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
      keywords: new Set<string>(variant.keywords ?? []),
      modelId: variant.generation.modelId,
      name: variant.name,
      fuelTypes: new Set<FuelType>(),
      yearStart: undefined,
      yearEnd: undefined,
      isCurrent: false,
    };

    for (const offering of variant.offerings) {
      (variant.keywords ?? []).forEach((keyword) => existing.keywords.add(keyword));
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
      keywords: uniqueKeywords([...variant.keywords]),
      modelId: variant.modelId,
      name: variant.name,
      fuelTypes: [...variant.fuelTypes],
      yearStart: variant.yearStart,
      yearEnd: variant.isCurrent ? undefined : variant.yearEnd,
      isCurrent: variant.isCurrent,
    }))
    .sort(compareVariantOptions);
}

function buildImportDiff(
  incomingDataset: VehicleCatalogImportDataset,
  publishedDataset: VehicleCatalogImportDataset,
) {
  const incoming = summarizeImportDataset(incomingDataset);
  const published = summarizeImportDataset(publishedDataset);

  return {
    incomingCounts: incoming.counts,
    publishedCounts: published.counts,
    newModels: [...incoming.modelKeys]
      .filter((key) => !published.modelKeys.has(key))
      .map((key) => incoming.modelLabels.get(key) ?? key)
      .sort(),
    newVariants: [...incoming.variantKeys]
      .filter((key) => !published.variantKeys.has(key))
      .map((key) => incoming.variantLabels.get(key) ?? key)
      .sort(),
    changedVariants: [...incoming.variantKeys]
      .filter((key) => published.variantKeys.has(key))
      .filter((key) => {
        const incomingSignatures = [...(incoming.variantOfferingSignatures.get(key) ?? [])].sort();
        const publishedSignatures = [
          ...(published.variantOfferingSignatures.get(key) ?? []),
        ].sort();

        return incomingSignatures.join('|') !== publishedSignatures.join('|');
      })
      .map((key) => incoming.variantLabels.get(key) ?? key)
      .sort(),
    missingVariants: [...published.variantKeys]
      .filter((key) => !incoming.variantKeys.has(key))
      .map((key) => published.variantLabels.get(key) ?? key)
      .sort(),
  };
}

function buildPublishedVariantKey(offering: {
  variant: {
    name: string;
    generation: {
      name: string;
      model: {
        name: string;
        make: {
          name: string;
          marketCode: string;
          vehicleType: string;
        };
      };
    };
  };
}) {
  const make = offering.variant.generation.model.make;
  const model = offering.variant.generation.model;
  const generation = offering.variant.generation;
  const variant = offering.variant;

  return [
    make.marketCode,
    make.vehicleType,
    normalizeKey(make.name),
    normalizeKey(model.name),
    normalizeKey(generation.name),
    normalizeKey(variant.name),
  ].join('|');
}

function buildFuelTypeSignature(fuelTypes: readonly string[]) {
  return [...fuelTypes].sort().join('|');
}

function buildOverrideKey(value: {
  variantId: string;
  sourceName: string;
  fuelTypeSignature: string;
}) {
  return `${value.variantId}|${value.sourceName}|${value.fuelTypeSignature}`;
}

function summarizeImportDataset(dataset: VehicleCatalogImportDataset): NormalizedCatalogSummary {
  const makeKeys = new Set<string>();
  const modelKeys = new Set<string>();
  const modelLabels = new Map<string, string>();
  const generationKeys = new Set<string>();
  const variantKeys = new Set<string>();
  const variantLabels = new Map<string, string>();
  const variantOfferingSignatures = new Map<string, string[]>();
  let offeringCount = 0;

  for (const make of dataset) {
    const makeKey = `${make.marketCode}|${make.vehicleType}|${normalizeKey(make.name)}`;
    makeKeys.add(makeKey);

    for (const model of make.models) {
      const modelKey = `${makeKey}|${normalizeKey(model.name)}`;
      modelKeys.add(modelKey);
      modelLabels.set(modelKey, `${make.name} / ${model.name}`);

      for (const generation of model.generations) {
        const generationKey = `${modelKey}|${normalizeKey(generation.name)}`;
        generationKeys.add(generationKey);

        for (const variant of generation.variants) {
          const variantKey = `${generationKey}|${normalizeKey(variant.name)}`;
          variantKeys.add(variantKey);
          variantLabels.set(
            variantKey,
            `${make.name} / ${model.name} / ${generation.name} / ${variant.name}`,
          );
          variantOfferingSignatures.set(
            variantKey,
            variant.offerings.map((offering) => buildOfferingSignature(offering)).sort(),
          );
          offeringCount += variant.offerings.length;
        }
      }
    }
  }

  return {
    counts: {
      makes: makeKeys.size,
      models: modelKeys.size,
      generations: generationKeys.size,
      variants: variantKeys.size,
      offerings: offeringCount,
    },
    modelKeys,
    modelLabels,
    variantKeys,
    variantLabels,
    variantOfferingSignatures,
  };
}

function parseImportDataset(payload: unknown): VehicleCatalogImportDataset {
  const dataset = (payload as { dataset?: unknown } | undefined)?.dataset ?? [];

  return VehicleCatalogImportDatasetSchema.parse(dataset);
}

function buildOfferingSignature(offering: {
  fuelTypes: FuelType[];
  isCurrent?: boolean;
  sourceUrl?: string;
  yearEnd?: number;
  yearStart?: number;
}) {
  return [
    [...offering.fuelTypes].sort().join(','),
    offering.yearStart ?? 'null',
    offering.yearEnd ?? 'null',
    offering.isCurrent ? 'current' : 'historical',
  ].join('|');
}

function compareImportMakes(
  left: VehicleCatalogImportDataset[number],
  right: VehicleCatalogImportDataset[number],
) {
  if (left.vehicleType !== right.vehicleType) {
    return left.vehicleType.localeCompare(right.vehicleType, 'en');
  }

  return left.name.localeCompare(right.name, 'en');
}

function compareVariantOptions(
  left: VehicleCatalogVariantOption,
  right: VehicleCatalogVariantOption,
) {
  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1;
  }

  if ((left.yearEnd ?? Number.MAX_SAFE_INTEGER) !== (right.yearEnd ?? Number.MAX_SAFE_INTEGER)) {
    return (right.yearEnd ?? Number.MAX_SAFE_INTEGER) - (left.yearEnd ?? Number.MAX_SAFE_INTEGER);
  }

  if (
    (left.yearStart ?? Number.MIN_SAFE_INTEGER) !== (right.yearStart ?? Number.MIN_SAFE_INTEGER)
  ) {
    return (
      (right.yearStart ?? Number.MIN_SAFE_INTEGER) - (left.yearStart ?? Number.MIN_SAFE_INTEGER)
    );
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

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}
