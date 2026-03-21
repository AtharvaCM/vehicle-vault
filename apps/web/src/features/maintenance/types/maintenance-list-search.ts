import { MaintenanceCategory } from '@vehicle-vault/shared';

export const maintenanceSortOptions = [
  'service-date-desc',
  'service-date-asc',
  'cost-desc',
  'odometer-desc',
] as const;

export type MaintenanceSortOption = (typeof maintenanceSortOptions)[number];

export type MaintenanceListSearch = {
  search?: string;
  category?: MaintenanceCategory | 'all';
  sort?: MaintenanceSortOption;
};

export const defaultMaintenanceSort: MaintenanceSortOption = 'service-date-desc';

export function normalizeMaintenanceListSearch(
  search: Record<string, unknown>,
): MaintenanceListSearch {
  const normalizedSearch =
    typeof search.search === 'string' && search.search.trim().length > 0
      ? search.search.trim()
      : undefined;
  const normalizedCategory =
    typeof search.category === 'string' &&
    (search.category === 'all' ||
      Object.values(MaintenanceCategory).includes(search.category as MaintenanceCategory))
      ? (search.category as MaintenanceCategory | 'all')
      : undefined;
  const normalizedSort =
    typeof search.sort === 'string' &&
    maintenanceSortOptions.includes(search.sort as MaintenanceSortOption)
      ? (search.sort as MaintenanceSortOption)
      : undefined;

  return {
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(normalizedCategory && normalizedCategory !== 'all'
      ? { category: normalizedCategory }
      : {}),
    ...(normalizedSort && normalizedSort !== defaultMaintenanceSort
      ? { sort: normalizedSort }
      : {}),
  };
}
