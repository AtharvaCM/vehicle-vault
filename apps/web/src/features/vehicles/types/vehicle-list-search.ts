export const vehicleSortOptions = [
  'updated-desc',
  'registration-asc',
  'odometer-desc',
  'year-desc',
] as const;

export type VehicleSortOption = (typeof vehicleSortOptions)[number];

export type VehicleListSearch = {
  search?: string;
  sort?: VehicleSortOption;
};

export const defaultVehicleSort: VehicleSortOption = 'updated-desc';

export function normalizeVehicleListSearch(search: Record<string, unknown>): VehicleListSearch {
  const normalizedSearch =
    typeof search.search === 'string' && search.search.trim().length > 0
      ? search.search.trim()
      : undefined;
  const normalizedSort =
    typeof search.sort === 'string' && vehicleSortOptions.includes(search.sort as VehicleSortOption)
      ? (search.sort as VehicleSortOption)
      : undefined;

  return {
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(normalizedSort && normalizedSort !== defaultVehicleSort ? { sort: normalizedSort } : {}),
  };
}
