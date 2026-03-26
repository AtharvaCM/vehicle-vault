import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { BulkVehicleActions } from '../components/bulk-vehicle-actions';
import { VehicleListControls } from '../components/vehicle-list-controls';
import { VehicleList } from '../components/vehicle-list';
import { useBulkDeleteVehicles } from '../hooks/use-bulk-delete-vehicles';
import { useVehicles } from '../hooks/use-vehicles';
import {
  defaultVehicleSort,
  type VehicleListSearch,
  type VehicleSortOption,
} from '../types/vehicle-list-search';

type VehiclesListPageProps = {
  searchState: VehicleListSearch;
  onSearchStateChange: (next: Partial<VehicleListSearch>) => void;
};

export function VehiclesListPage({ searchState, onSearchStateChange }: VehiclesListPageProps) {
  const vehiclesQuery = useVehicles();
  const bulkDeleteMutation = useBulkDeleteVehicles();
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const searchValue = searchState.search ?? '';
  const sortBy: VehicleSortOption = searchState.sort ?? defaultVehicleSort;

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return [...(vehiclesQuery.data ?? [])]
      .filter((vehicle) => {
        if (!normalizedSearch) {
          return true;
        }

        const searchFields = [
          vehicle.registrationNumber,
          vehicle.make,
          vehicle.model,
          vehicle.variant,
          vehicle.nickname ?? '',
          vehicle.fuelType,
          vehicle.vehicleType,
        ];

        return searchFields.some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        switch (sortBy) {
          case 'registration-asc':
            return left.registrationNumber.localeCompare(right.registrationNumber, 'en', {
              sensitivity: 'base',
            });
          case 'odometer-desc':
            return right.odometer - left.odometer;
          case 'year-desc':
            return right.year - left.year;
          case 'updated-desc':
          default:
            return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        }
      });
  }, [searchValue, sortBy, vehiclesQuery.data]);
  const visibleVehicleIds = useMemo(
    () => filteredVehicles.map((vehicle) => vehicle.id),
    [filteredVehicles],
  );

  useEffect(() => {
    setSelectedVehicleIds((current) =>
      current.filter((vehicleId) => visibleVehicleIds.includes(vehicleId)),
    );
  }, [visibleVehicleIds]);

  function resetControls() {
    onSearchStateChange({});
  }

  function handleSelectionChange(vehicleId: string, checked: boolean) {
    setSelectedVehicleIds((current) => {
      if (checked) {
        return current.includes(vehicleId) ? current : [...current, vehicleId];
      }

      return current.filter((currentId) => currentId !== vehicleId);
    });
  }

  async function handleBulkDelete() {
    if (!selectedVehicleIds.length) {
      return;
    }

    const idsToDelete = [...selectedVehicleIds];

    try {
      await bulkDeleteMutation.mutateAsync(idsToDelete);
      appToast.success({
        title: 'Vehicles deleted',
        description: `Deleted ${idsToDelete.length} vehicle${idsToDelete.length === 1 ? '' : 's'}.`,
      });
      setSelectedVehicleIds([]);
    } catch (error) {
      appToast.error({
        title: 'Unable to delete vehicles',
        description: getApiErrorMessage(
          error,
          "We couldn't delete the selected vehicles right now.",
        ),
      });
    }
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants()} to="/vehicles/new">
            Add Vehicle
          </Link>
        }
        description="Keep every vehicle in one place so service history, reminders, and receipts stay connected."
        title="Vehicles"
      />

      {vehiclesQuery.isPending ? (
        <LoadingState description="Loading the vehicles in your garage." title="Loading vehicles" />
      ) : vehiclesQuery.isError ? (
        <ErrorState
          action={
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => vehiclesQuery.refetch()} variant="secondary">
                Retry
              </Button>
              <Link className={buttonVariants()} to="/vehicles/new">
                Add Vehicle
              </Link>
            </div>
          }
          description="We couldn't load your vehicles. Try again in a moment."
          title="Unable to load vehicles"
        />
      ) : vehiclesQuery.data.length ? (
        <div className="space-y-4">
          <VehicleListControls
            onReset={resetControls}
            onSearchChange={(value) => onSearchStateChange({ search: value || undefined })}
            onSortChange={(value) => onSearchStateChange({ sort: value })}
            resultCount={filteredVehicles.length}
            searchValue={searchValue}
            sortBy={sortBy}
            totalCount={vehiclesQuery.data.length}
          />
          <BulkVehicleActions
            isDeleting={bulkDeleteMutation.isPending}
            onClearSelection={() => setSelectedVehicleIds([])}
            onDeleteSelected={handleBulkDelete}
            onSelectAllVisible={() => setSelectedVehicleIds(visibleVehicleIds)}
            selectedCount={selectedVehicleIds.length}
            visibleCount={visibleVehicleIds.length}
          />
          {filteredVehicles.length ? (
            <VehicleList
              onSelectionChange={handleSelectionChange}
              selectedVehicleIds={selectedVehicleIds}
              vehicles={filteredVehicles}
            />
          ) : (
            <EmptyState
              action={
                <div className="flex flex-wrap gap-3">
                  <Button onClick={resetControls} variant="secondary">
                    Clear filters
                  </Button>
                  <Link className={buttonVariants()} to="/vehicles/new">
                    Add Vehicle
                  </Link>
                </div>
              }
              description="Try a different search or sort to bring more vehicles into view."
              title="No vehicles match these filters"
            />
          )}
        </div>
      ) : (
        <EmptyState
          action={
            <Link className={buttonVariants()} to="/vehicles/new">
              Add your first vehicle
            </Link>
          }
          description="Add your first car or bike to start tracking maintenance, reminders, and receipts."
          title="No vehicles yet"
        />
      )}
    </PageContainer>
  );
}
