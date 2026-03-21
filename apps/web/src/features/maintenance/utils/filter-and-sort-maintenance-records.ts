import { type MaintenanceCategory } from '@vehicle-vault/shared';

import type { MaintenanceRecord } from '../types/maintenance-record';
import type { MaintenanceSortOption } from '../types/maintenance-list-search';
import { formatMaintenanceCategory } from './format-maintenance-category';

type FilterAndSortMaintenanceRecordsArgs = {
  records: MaintenanceRecord[];
  searchValue: string;
  category: MaintenanceCategory | 'all';
  sortBy: MaintenanceSortOption;
  vehicleLabelById?: Record<string, string>;
};

export function filterAndSortMaintenanceRecords({
  records,
  searchValue,
  category,
  sortBy,
  vehicleLabelById = {},
}: FilterAndSortMaintenanceRecordsArgs) {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return [...records]
    .filter((record) => {
      if (category !== 'all' && record.category !== category) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchFields = [
        record.workshopName ?? '',
        record.notes ?? '',
        record.serviceDate,
        record.odometer.toString(),
        formatMaintenanceCategory(record.category),
        vehicleLabelById[record.vehicleId] ?? '',
      ];

      return searchFields.some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => {
      switch (sortBy) {
        case 'service-date-asc':
          return Date.parse(left.serviceDate) - Date.parse(right.serviceDate);
        case 'cost-desc':
          return right.totalCost - left.totalCost;
        case 'odometer-desc':
          return right.odometer - left.odometer;
        case 'service-date-desc':
        default:
          return Date.parse(right.serviceDate) - Date.parse(left.serviceDate);
      }
    });
}
