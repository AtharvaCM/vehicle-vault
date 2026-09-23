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
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { BulkMaintenanceActions } from '../components/bulk-maintenance-actions';
import { MaintenanceImportDialog } from '../components/maintenance-import-dialog';
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
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const bulkDeleteMutation = useBulkDeleteMaintenanceRecords();
  const [isImportOpen, setIsImportOpen] = useState(false);
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
        title: 'Service records deleted',
        description: `Deleted ${idsToDelete.length} service record${idsToDelete.length === 1 ? '' : 's'}.`,
      });
      setSelectedRecordIds([]);
    } catch (error) {
      appToast.error({
        title: 'Unable to delete service records',
        description: getApiErrorMessage(
          error,
          "We couldn't delete the selected service records right now.",
        ),
      });
    }
  }

  if (isVehicleNotFound || isMaintenanceVehicleNotFound) {
    return (
      <PageContainer>
        <PageTitle
          description="Service records are scoped to an existing vehicle."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so its service records are unavailable."
          title="Vehicle not found"
        />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer>
        <PageTitle
          actions={
            <>
              <Link
                className={buttonVariants({ variant: 'secondary' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId"
              >
                Back to vehicle
              </Link>
              {canEdit ? (
                <>
                  <Button onClick={() => setIsImportOpen(true)} type="button" variant="outline">
                    Import CSV
                  </Button>
                  <Link
                    className={buttonVariants()}
                    params={{ vehicleId }}
                    to="/vehicles/$vehicleId/maintenance/new"
                  >
                    Log service
                  </Link>
                </>
              ) : null}
            </>
          }
          description="See every service record tied to this vehicle."
          title={`${vehicleTitle} Maintenance`}
        />

        {maintenanceQuery.isPending ? (
          <LoadingState
            description="Loading service records for this vehicle."
            title="Loading service records"
          />
        ) : maintenanceQuery.isError ? (
          <ErrorState
            action={
              <Button onClick={() => maintenanceQuery.refetch()} variant="secondary">
                Retry
              </Button>
            }
            description="We couldn't load this vehicle's service records. Try again in a moment."
            title="Unable to load service records"
          />
        ) : (
          <div className="space-y-4">
            {canEdit ? (
              <MaintenanceImportDialog
                onOpenChange={setIsImportOpen}
                open={isImportOpen}
                vehicleId={vehicleId}
              />
            ) : null}
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
                {canEdit ? (
                  <BulkMaintenanceActions
                    isDeleting={bulkDeleteMutation.isPending}
                    onClearSelection={() => setSelectedRecordIds([])}
                    onDeleteSelected={handleBulkDelete}
                    onSelectAllVisible={() => setSelectedRecordIds(visibleRecordIds)}
                    selectedCount={selectedRecordIds.length}
                    visibleCount={visibleRecordIds.length}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
              {maintenanceQuery.data.length ? (
                filteredRecords.length ? (
                  <MaintenanceRecordList
                    onSelectionChange={canEdit ? handleSelectionChange : undefined}
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
                    title="No service records match these filters"
                  />
                )
              ) : (
                <EmptyState
                  action={
                    canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setIsImportOpen(true)}
                          type="button"
                          variant="outline"
                        >
                          Import CSV
                        </Button>
                        <Link
                          className={buttonVariants()}
                          params={{ vehicleId }}
                          to="/vehicles/$vehicleId/maintenance/new"
                        >
                          Log your first service
                        </Link>
                      </div>
                    ) : undefined
                  }
                  description={
                    canEdit
                      ? 'No service records have been logged for this vehicle yet.'
                      : 'No service records have been logged for this vehicle yet. Whoever owns it can add them.'
                  }
                  title="No service records yet"
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
    </VehicleAccessProvider>
  );
}
