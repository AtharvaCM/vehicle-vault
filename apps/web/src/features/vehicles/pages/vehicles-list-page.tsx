import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';

import { VehicleListControls, type VehicleSortOption } from '../components/vehicle-list-controls';
import { VehicleList } from '../components/vehicle-list';
import { useVehicles } from '../hooks/use-vehicles';

export function VehiclesListPage() {
  const vehiclesQuery = useVehicles();
  const [searchValue, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState<VehicleSortOption>('updated-desc');

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

  function resetControls() {
    setSearchValue('');
    setSortBy('updated-desc');
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants()} to="/vehicles/new">
            Add Vehicle
          </Link>
        }
        description="Manage the vehicles that anchor maintenance history, reminders, and receipts across the product."
        title="Vehicles"
      />

      {vehiclesQuery.isPending ? (
        <LoadingState
          description="Fetching vehicle records from the API."
          title="Loading vehicles"
        />
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
          description="The vehicle list could not be loaded. Make sure the API is running and reachable from the frontend."
          title="Unable to load vehicles"
        />
      ) : vehiclesQuery.data.length ? (
        <div className="space-y-4">
          <VehicleListControls
            onReset={resetControls}
            onSearchChange={setSearchValue}
            onSortChange={setSortBy}
            resultCount={filteredVehicles.length}
            searchValue={searchValue}
            sortBy={sortBy}
            totalCount={vehiclesQuery.data.length}
          />
          {filteredVehicles.length ? (
            <VehicleList vehicles={filteredVehicles} />
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
              description="Adjust the current search or sorting choices to reveal more vehicles."
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
          description="No vehicles exist yet. Create the first one to start the maintenance workflow."
          title="No vehicles yet"
        />
      )}
    </PageContainer>
  );
}
