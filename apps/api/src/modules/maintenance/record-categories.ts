import { MaintenanceCategory, type Prisma } from '@prisma/client';

/**
 * A service record as far as "which services did it do" is concerned: its own
 * category, plus the categories its line items were normalized to.
 */
export type CategorizedRecord = {
  category: string;
  lineItems?: readonly { normalizedCategory?: string | null }[] | null;
};

/** The line-item columns {@link categoriesCovered} reads, for a Prisma `select`/`include`. */
export const LINE_ITEM_CATEGORY_SELECT = {
  select: { normalizedCategory: true },
} as const;

/**
 * Every service category a record is evidence of: its own, plus each line
 * item's. A periodic service whose invoice lists an oil filter is also an oil
 * filter change; reading only the record's `category` kept the filter
 * reminder running after the filter was replaced. `other` names nothing a
 * reminder can be timed by, so a line item tagged with it adds nothing.
 */
export function categoriesCovered(record: CategorizedRecord): Set<string> {
  const covered = new Set<string>([record.category]);
  for (const item of record.lineItems ?? []) {
    if (item.normalizedCategory && item.normalizedCategory !== MaintenanceCategory.other) {
      covered.add(item.normalizedCategory);
    }
  }
  return covered;
}

export function coversCategory(record: CategorizedRecord, category: string): boolean {
  return categoriesCovered(record).has(category);
}

/** Records that are evidence of any of `categories`, by their own category or a line item's. */
export function coveringAnyOf(categories: readonly string[]): Prisma.MaintenanceRecordWhereInput {
  const inCategories = { in: categories as MaintenanceCategory[] };
  return {
    OR: [{ category: inCategories }, { lineItems: { some: { normalizedCategory: inCategories } } }],
  };
}
