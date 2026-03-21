import { Link } from '@tanstack/react-router';
import { MaintenanceCategory } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import {
  MaintenanceListControls,
  type MaintenanceSortOption,
} from '../components/maintenance-list-controls';
import { useMaintenanceRecords } from '../hooks/use-maintenance-records';
import { MaintenanceRecordList } from '../components/maintenance-record-list';
import { filterAndSortMaintenanceRecords } from '../utils/filter-and-sort-maintenance-records';

type VehicleMaintenanceListPageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceListPage({ vehicleId }: VehicleMaintenanceListPageProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const maintenanceQuery = useMaintenanceRecords(vehicleId);
  const [searchValue, setSearchValue] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<MaintenanceSortOption>('service-date-desc');

  const vehicleTitle = vehicleQuery.data
    ? vehicleQuery.data.nickname?.trim() || `${vehicleQuery.data.make} ${vehicleQuery.data.model}`
    : 'Maintenance';
  const isVehicleNotFound =
    vehicleQuery.error instanceof ApiError && vehicleQuery.error.status === 404;
  const isMaintenanceVehicleNotFound =
    maintenanceQuery.error instanceof ApiError && maintenanceQuery.error.status === 404;

  const filteredRecords = useMemo(() => {
    return filterAndSortMaintenanceRecords({
      records: maintenanceQuery.data ?? [],
      searchValue,
      category,
      sortBy,
    });
  }, [category, maintenanceQuery.data, searchValue, sortBy]);

  function resetControls() {
    setSearchValue('');
    setCategory('all');
    setSortBy('service-date-desc');
  }

  if (isVehicleNotFound || isMaintenanceVehicleNotFound) {
    return (
      <PageContainer>
        <PageTitle
          description="Maintenance history is scoped to an existing vehicle record."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so its maintenance history is unavailable."
          title="Vehicle not found"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <div className="flex gap-3">
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId"
            >
              Back to Vehicle
            </Link>
            <Link
              className={buttonVariants()}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/maintenance/new"
            >
              Add Maintenance
            </Link>
          </div>
        }
        description="See every service entry tied to this vehicle."
        title={`${vehicleTitle} Maintenance`}
      />

      {maintenanceQuery.isPending ? (
        <LoadingState
          description="Loading maintenance history for this vehicle."
          title="Loading maintenance"
        />
      ) : maintenanceQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => maintenanceQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load this vehicle's maintenance history. Try again in a moment."
          title="Unable to load maintenance records"
        />
      ) : (
        <div className="space-y-4">
          {maintenanceQuery.data.length ? (
            <MaintenanceListControls
              category={category}
              onCategoryChange={setCategory}
              onReset={resetControls}
              onSearchChange={setSearchValue}
              onSortChange={setSortBy}
              resultCount={filteredRecords.length}
              searchValue={searchValue}
              sortBy={sortBy}
              totalCount={maintenanceQuery.data.length}
            />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            {maintenanceQuery.data.length ? (
              filteredRecords.length ? (
                <MaintenanceRecordList records={filteredRecords} />
              ) : (
                <EmptyState
                  action={
                    <Button onClick={resetControls} variant="secondary">
                      Clear filters
                    </Button>
                  }
                  description="Try a broader search or remove the current category filter."
                  title="No maintenance records match these filters"
                />
              )
            ) : (
              <EmptyState
                action={
                  <Link
                    className={buttonVariants()}
                    params={{ vehicleId }}
                    to="/vehicles/$vehicleId/maintenance/new"
                  >
                    Add the first maintenance record
                  </Link>
                }
                description="No service entries have been logged for this vehicle yet."
                title="No maintenance records yet"
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Keep service history complete</CardTitle>
                <CardDescription>
                  Use this page as the full service log for one vehicle.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <p>Capture each completed job with the date, odometer, and total cost.</p>
                <p>Open any entry to review notes and manage receipts.</p>
                <p>Use next due fields so future work is easier to plan.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
