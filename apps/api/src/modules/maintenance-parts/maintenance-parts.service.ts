import { Injectable } from '@nestjs/common';
import { MaintenanceCategory, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type CatalogPartInput = {
  name: string;
  partNumber?: string | null;
  brand?: string | null;
  category?: MaintenanceCategory | null;
};

export type CatalogSuggestion = {
  id: string;
  displayName: string;
  partNumber: string | null;
  brand: string | null;
  suggestedCategory: MaintenanceCategory;
  occurrences: number;
};

@Injectable()
export class MaintenancePartsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up the best category suggestion for a part name (+ optional part number).
   * Exact `(name, partNumber)` wins; falls back to name-only match.
   */
  async suggestCategory(
    name: string,
    partNumber?: string | null,
  ): Promise<CatalogSuggestion | null> {
    const nameNormalized = normalizeName(name);
    if (!nameNormalized) return null;

    if (partNumber) {
      const exact = await this.prisma.maintenancePartCatalog.findFirst({
        where: { nameNormalized, partNumber },
        orderBy: { occurrences: 'desc' },
      });
      if (exact) return toSuggestion(exact);
    }

    const byName = await this.prisma.maintenancePartCatalog.findFirst({
      where: { nameNormalized },
      orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
    });
    return byName ? toSuggestion(byName) : null;
  }

  async searchByPrefix(query: string, limit = 10): Promise<CatalogSuggestion[]> {
    const nameNormalized = normalizeName(query);
    if (!nameNormalized) return [];

    const rows = await this.prisma.maintenancePartCatalog.findMany({
      where: { nameNormalized: { startsWith: nameNormalized } },
      orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
      take: limit,
    });
    return rows.map(toSuggestion);
  }

  /**
   * Record a part observation. Bumps occurrences when we've seen it before;
   * upgrades `suggestedCategory` if the caller has a stronger signal (a concrete
   * category beats `other`/null on an existing row).
   *
   * Safe to call from any tx; uses the passed-in client when provided.
   */
  async recordObservation(
    input: CatalogPartInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const nameNormalized = normalizeName(input.name);
    if (!nameNormalized) return;

    const partNumber = input.partNumber?.trim() || null;
    const category = input.category ?? MaintenanceCategory.other;

    // Cannot rely on @@unique([name, partNumber]) when partNumber is NULL,
    // because Postgres treats NULLs as distinct. Lookup-then-upsert is fine
    // here — observations come one at a time from request handlers, not bulk.
    const existing = await client.maintenancePartCatalog.findFirst({
      where: { nameNormalized, partNumber },
    });

    if (!existing) {
      await client.maintenancePartCatalog.create({
        data: {
          nameNormalized,
          partNumber,
          displayName: input.name.trim(),
          brand: input.brand?.trim() || null,
          suggestedCategory: category,
          occurrences: 1,
        },
      });
      return;
    }

    const shouldUpgradeCategory =
      existing.suggestedCategory === MaintenanceCategory.other &&
      category !== MaintenanceCategory.other;

    await client.maintenancePartCatalog.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        displayName: input.name.trim(),
        brand: input.brand?.trim() || existing.brand,
        suggestedCategory: shouldUpgradeCategory ? category : existing.suggestedCategory,
      },
    });
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toSuggestion(
  row: {
    id: string;
    displayName: string;
    partNumber: string | null;
    brand: string | null;
    suggestedCategory: MaintenanceCategory;
    occurrences: number;
  },
): CatalogSuggestion {
  return {
    id: row.id,
    displayName: row.displayName,
    partNumber: row.partNumber,
    brand: row.brand,
    suggestedCategory: row.suggestedCategory,
    occurrences: row.occurrences,
  };
}
