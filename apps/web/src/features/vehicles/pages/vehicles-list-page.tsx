import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { EmptyGarage } from '@/features/onboarding/components/empty-garage';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDashboardSummary } from '@/features/dashboard/hooks/use-dashboard-summary';
import type { DashboardVehicleHealth } from '@/features/dashboard/types/dashboard';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { BulkVehicleActions } from '../components/bulk-vehicle-actions';
import { byUrgency, GarageRow } from '../components/garage-row';
import { useBulkDeleteVehicles } from '../hooks/use-bulk-delete-vehicles';
import { useVehicles } from '../hooks/use-vehicles';
import {
  defaultVehicleSort,
  type VehicleListSearch,
  type VehicleSortOption,
} from '../types/vehicle-list-search';

/** Search shows up once the garage is longer than this: below it, the list is the search. */
const SEARCH_FROM = 6;

type VehiclesListPageProps = {
  searchState: VehicleListSearch;
  onSearchStateChange: (next: Partial<VehicleListSearch>) => void;
};

export function VehiclesListPage({ searchState, onSearchStateChange }: VehiclesListPageProps) {
  const vehiclesQuery = useVehicles();
  const summaryQuery = useDashboardSummary();
  const bulkDeleteMutation = useBulkDeleteVehicles();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const health = useMemo(
    () =>
      new Map<string, DashboardVehicleHealth>(
        (summaryQuery.data?.vehicles ?? []).map((entry) => [entry.id, entry]),
      ),
    [summaryQuery.data?.vehicles],
  );
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
          vehicle.variant ?? '',
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
            return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
          case 'urgency':
          default:
            return byUrgency(health)(left, right);
        }
      });
  }, [health, searchValue, sortBy, vehiclesQuery.data]);
  const visibleVehicleIds = useMemo(
    () => filteredVehicles.map((vehicle) => vehicle.id),
    [filteredVehicles],
  );
  const selectedVehicles = useMemo(
    () => filteredVehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)),
    [filteredVehicles, selectedVehicleIds],
  );

  useEffect(() => {
    setSelectedVehicleIds((current) =>
      current.filter((vehicleId) => visibleVehicleIds.includes(vehicleId)),
    );
  }, [visibleVehicleIds]);

  function resetControls() {
    onSearchStateChange({});
  }

  function stopSelecting() {
    setIsSelecting(false);
    setSelectedVehicleIds([]);
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
      stopSelecting();
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
          <>
            {(vehiclesQuery.data?.length ?? 0) > 1 ? (
              <Button
                aria-pressed={isSelecting}
                onClick={() => (isSelecting ? stopSelecting() : setIsSelecting(true))}
                type="button"
                variant="outline"
              >
                {isSelecting ? 'Done' : 'Select'}
              </Button>
            ) : null}
            <Link className={buttonVariants()} to="/vehicles/new">
              Add vehicle
            </Link>
          </>
        }
        description="Keep every vehicle in one place so service history, reminders, and receipts stay connected."
        title="Garage"
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
                Add vehicle
              </Link>
            </div>
          }
          description="We couldn't load your vehicles. Try again in a moment."
          title="Unable to load vehicles"
        />
      ) : vehiclesQuery.data.length ? (
        <div className="space-y-4">
          {vehiclesQuery.data.length > SEARCH_FROM || searchValue ? (
            <div className="relative max-w-md">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3"
              />
              <Input
                aria-label="Search vehicles"
                className="pl-9"
                onChange={(event) =>
                  onSearchStateChange({ search: event.currentTarget.value || undefined })
                }
                placeholder="Search by name, plate or model"
                type="search"
                value={searchValue}
              />
            </div>
          ) : null}
          {isSelecting ? (
            <BulkVehicleActions
              isDeleting={bulkDeleteMutation.isPending}
              onClearSelection={() => setSelectedVehicleIds([])}
              onDeleteSelected={handleBulkDelete}
              onSelectAllVisible={() => setSelectedVehicleIds(visibleVehicleIds)}
              selectedVehicles={selectedVehicles}
              visibleCount={visibleVehicleIds.length}
            />
          ) : null}
          {filteredVehicles.length ? (
            <Card className="overflow-hidden p-0">
              <ul aria-label="Vehicles" className="divide-y divide-line-subtle">
                {filteredVehicles.map((vehicle) => (
                  <GarageRow
                    health={health.get(vehicle.id)}
                    key={vehicle.id}
                    onSelectedChange={(checked) => handleSelectionChange(vehicle.id, checked)}
                    selectable={isSelecting}
                    selected={selectedVehicleIds.includes(vehicle.id)}
                    vehicle={vehicle}
                  />
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              action={
                <div className="flex flex-wrap gap-3">
                  <Button onClick={resetControls} variant="secondary">
                    Clear search
                  </Button>
                  <Link className={buttonVariants()} to="/vehicles/new">
                    Add vehicle
                  </Link>
                </div>
              }
              description="Try a different search to bring more vehicles into view."
              title="No vehicles match this search"
            />
          )}
        </div>
      ) : (
        <EmptyGarage />
      )}
    </PageContainer>
  );
}
