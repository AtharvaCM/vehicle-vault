import { Injectable, Logger } from '@nestjs/common';
import { FuelType, VehicleType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type CatalogLinkInput = {
  make: string;
  model: string;
  year: number;
  vehicleType: VehicleType;
  fuelType: FuelType;
};

export type CatalogLinkResult = {
  variantId: string | null;
  generationId: string | null;
};

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

/**
 * Best-effort match from a free-text user vehicle (make/model/year/fuelType +
 * vehicleType) to a catalog variant. Returns a variant id only when the lookup
 * narrows to exactly one candidate; otherwise null so the caller can keep
 * catalogVariantId unset and surface "pick your variant" in the UI.
 */
@Injectable()
export class VehicleCatalogLinkerService {
  private readonly logger = new Logger(VehicleCatalogLinkerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findMatchingVariantId(input: CatalogLinkInput): Promise<string | null> {
    const { variantId } = await this.resolveCatalogLink(input);
    return variantId;
  }

  /**
   * Returns the most specific catalog references that can be inferred from the
   * input. variantId is set only when exactly one variant survives the funnel;
   * generationId is set when narrowing reaches a single generation, even if
   * the variant choice is ambiguous.
   */
  async resolveCatalogLink(input: CatalogLinkInput): Promise<CatalogLinkResult> {
    const empty: CatalogLinkResult = { variantId: null, generationId: null };
    const makeNorm = normalize(input.make);
    const modelNorm = normalize(input.model);
    if (!makeNorm || !modelNorm) return empty;

    // 1. Resolve candidate makes by alias or direct name, ignoring
    //    vehicleType — users mix up car/suv for crossovers like the Creta,
    //    but the catalog only files them once. Filter by model match later.
    const aliasMatches = await this.prisma.vehicleCatalogMakeAlias.findMany({
      where: { normalizedAlias: makeNorm },
      select: { makeId: true },
    });
    const directMatches = await this.prisma.vehicleCatalogMake.findMany({
      where: {
        OR: [
          { slug: makeNorm.replace(/ /g, '-') },
          { name: { equals: input.make, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    const candidateMakeIds = Array.from(
      new Set([...aliasMatches.map((a) => a.makeId), ...directMatches.map((m) => m.id)]),
    );

    if (candidateMakeIds.length === 0) return empty;

    // 2. Resolve model via alias OR direct name match within any candidate make.
    const modelAlias = await this.prisma.vehicleCatalogModelAlias.findFirst({
      where: { normalizedAlias: modelNorm, model: { makeId: { in: candidateMakeIds } } },
      select: { modelId: true },
    });

    const modelId =
      modelAlias?.modelId ??
      (
        await this.prisma.vehicleCatalogModel.findFirst({
          where: {
            makeId: { in: candidateMakeIds },
            OR: [
              { slug: modelNorm.replace(/ /g, '-') },
              { name: { equals: input.model, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        })
      )?.id;

    if (!modelId) return empty;

    // 3. Pick the most-specific generation whose year range covers the user's
    //    year. Catalog ingest can leave overlapping generations (e.g. Creta
    //    has a "lineup" wrapper plus a year-scoped facelift entry); prefer
    //    those with an explicit yearStart that includes the user's year,
    //    falling back to current generations.
    const generations = await this.prisma.vehicleCatalogGeneration.findMany({
      where: { modelId },
      select: { id: true, yearStart: true, yearEnd: true, isCurrent: true },
    });

    const inRange = generations.filter(
      (g) =>
        (g.yearStart == null || g.yearStart <= input.year) &&
        (g.yearEnd == null || g.yearEnd >= input.year),
    );

    const explicitRange = inRange.filter((g) => g.yearStart != null);

    let candidateGens: typeof generations;
    if (explicitRange.length > 0) {
      candidateGens = explicitRange;
    } else if (inRange.length > 0) {
      candidateGens = inRange;
    } else {
      const current = generations.filter((g) => g.isCurrent);
      if (current.length === 0) return empty;
      candidateGens = current;
    }

    // Generation-level resolution: single candidate gets surfaced even when
    // variant disambiguation fails.
    const generationId =
      candidateGens.length === 1 && candidateGens[0] ? candidateGens[0].id : null;

    // 4. Filter variants by fuel-type offering. Auto-link only when exactly
    //    one variant survives the funnel — otherwise the user must choose.
    const variants = await this.prisma.vehicleCatalogVariant.findMany({
      where: {
        generationId: { in: candidateGens.map((g) => g.id) },
        offerings: { some: { fuelTypes: { has: input.fuelType } } },
      },
      select: { id: true, generationId: true },
    });

    if (variants.length === 1 && variants[0]) {
      return {
        variantId: variants[0].id,
        generationId: variants[0].generationId,
      };
    }

    return { variantId: null, generationId };
  }

  /**
   * Backfill helper: scan vehicles missing catalogVariantId and link the ones
   * that resolve to a single variant. Safe to re-run; only writes when a
   * match is found.
   */
  async backfillUnmatched(): Promise<{ scanned: number; linked: number }> {
    const unmatched = await this.prisma.vehicle.findMany({
      where: { catalogVariantId: null },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        vehicleType: true,
        fuelType: true,
      },
    });

    let linked = 0;
    for (const v of unmatched) {
      const { variantId, generationId } = await this.resolveCatalogLink({
        make: v.make,
        model: v.model,
        year: v.year,
        vehicleType: v.vehicleType,
        fuelType: v.fuelType,
      });
      if (!variantId && !generationId) continue;
      await this.prisma.vehicle.update({
        where: { id: v.id },
        data: { catalogVariantId: variantId, catalogGenerationId: generationId },
      });
      linked++;
    }

    this.logger.log(`Catalog backfill: scanned ${unmatched.length}, linked ${linked}`);
    return { scanned: unmatched.length, linked };
  }
}
