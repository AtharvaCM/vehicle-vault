import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { BulkMaintenanceActions } from '../components/bulk-maintenance-actions';
import { MaintenanceListControls } from '../components/maintenance-list-controls';
import { useMaintenanceRecords } from '../hooks/use-maintenance-records';
import { MaintenanceRecordList } from '../components/maintenance-record-list';
import { useBulkDeleteMaintenanceRecords } from '../hooks/use-bulk-delete-maintenance-records';
import { filterAndSortMaintenanceRecords } from '../utils/filter-and-sort-maintenance-records';
import {
  defaultMaintenanceSort,
  type MaintenanceListSearch,
  type MaintenanceSortOption,
} from '../types/maintenance-list-search';

type VehicleMaintenanceListPageProps = {
  vehicleId: string;
  searchState: MaintenanceListSearch;
  onSearchStateChange: (next: Partial<MaintenanceListSearch>) => void;
};

export function VehicleMaintenanceListPage({
  vehicleId,
  searchState,
  onSearchStateChange,
}: VehicleMaintenanceListPageProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const maintenanceQuery = useMaintenanceRecords(vehicleId);
  const bulkDeleteMutation = useBulkDeleteMaintenanceRecords();
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const searchValue = searchState.search ?? '';
  const category = searchState.category ?? 'all';
  const sortBy: MaintenanceSortOption = searchState.sort ?? defaultMaintenanceSort;

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
  const visibleRecordIds = useMemo(
    () => filteredRecords.map((record) => record.id),
    [filteredRecords],
  );

  useEffect(() => {
    setSelectedRecordIds((current) =>
      current.filter((recordId) => visibleRecordIds.includes(recordId)),
    );
  }, [visibleRecordIds]);

  function resetControls() {
    onSearchStateChange({});
  }

  function handleSelectionChange(recordId: string, checked: boolean) {
    setSelectedRecordIds((current) => {
      if (checked) {
        return current.includes(recordId) ? current : [...current, recordId];
      }

      return current.filter((currentId) => currentId !== recordId);
    });
  }

  async function handleBulkDelete() {
    if (!selectedRecordIds.length) {
      return;
    }

    const idsToDelete = [...selectedRecordIds];

    try {
      await bulkDeleteMutation.mutateAsync(idsToDelete);
      appToast.success({
        title: 'Maintenance records deleted',
        description: `Deleted ${idsToDelete.length} maintenance record${idsToDelete.length === 1 ? '' : 's'}.`,
      });
      setSelectedRecordIds([]);
    } catch (error) {
      appToast.error({
        title: 'Unable to delete maintenance records',
        description: getApiErrorMessage(
          error,
          "We couldn't delete the selected maintenance records right now.",
        ),
      });
    }
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
            <div className="space-y-4">
              <MaintenanceListControls
                category={category}
                onCategoryChange={(value) => onSearchStateChange({ category: value })}
                onReset={resetControls}
                onSearchChange={(value) => onSearchStateChange({ search: value || undefined })}
                onSortChange={(value) => onSearchStateChange({ sort: value })}
                resultCount={filteredRecords.length}
                searchValue={searchValue}
                sortBy={sortBy}
                totalCount={maintenanceQuery.data.length}
              />
              <BulkMaintenanceActions
                isDeleting={bulkDeleteMutation.isPending}
                onClearSelection={() => setSelectedRecordIds([])}
                onDeleteSelected={handleBulkDelete}
                onSelectAllVisible={() => setSelectedRecordIds(visibleRecordIds)}
                selectedCount={selectedRecordIds.length}
                visibleCount={visibleRecordIds.length}
              />
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            {maintenanceQuery.data.length ? (
              filteredRecords.length ? (
                <MaintenanceRecordList
                  onSelectionChange={handleSelectionChange}
                  records={filteredRecords}
                  selectedRecordIds={selectedRecordIds}
                />
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
