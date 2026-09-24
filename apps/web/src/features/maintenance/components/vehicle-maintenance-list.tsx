import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';

import { BulkMaintenanceActions } from './bulk-maintenance-actions';
import { MaintenanceImportDialog } from './maintenance-import-dialog';
import { MaintenanceListControls } from './maintenance-list-controls';
import { MaintenanceRecordList } from './maintenance-record-list';
import { useMaintenanceRecords } from '../hooks/use-maintenance-records';
import { useBulkDeleteMaintenanceRecords } from '../hooks/use-bulk-delete-maintenance-records';
import { filterAndSortMaintenanceRecords } from '../utils/filter-and-sort-maintenance-records';
import {
  defaultMaintenanceSort,
  type MaintenanceListSearch,
  type MaintenanceSortOption,
} from '../types/maintenance-list-search';

type VehicleMaintenanceListProps = {
  vehicleId: string;
};

export function VehicleMaintenanceList({ vehicleId }: VehicleMaintenanceListProps) {
  const { canEdit } = useVehicleAccess();
  const maintenanceQuery = useMaintenanceRecords(vehicleId);
  const bulkDeleteMutation = useBulkDeleteMaintenanceRecords();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [searchState, setSearchState] = useState<MaintenanceListSearch>({});
  const searchValue = searchState.search ?? '';
  const category = searchState.category ?? 'all';
  const sortBy: MaintenanceSortOption = searchState.sort ?? defaultMaintenanceSort;

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

  // Drop selected rows the filters now hide. Returning `current` when nothing
  // was dropped keeps the state, so a list that re-renders does not loop.
  useEffect(() => {
    setSelectedRecordIds((current) => {
      const kept = current.filter((recordId) => visibleRecordIds.includes(recordId));
      return kept.length === current.length ? current : kept;
    });
  }, [visibleRecordIds]);

  function onSearchStateChange(next: Partial<MaintenanceListSearch>) {
    setSearchState((current) => ({ ...current, ...next }));
  }

  function resetControls() {
    setSearchState({});
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

  if (maintenanceQuery.isPending) {
    return (
      <LoadingState
        description="Loading service records for this vehicle."
        title="Loading service records"
      />
    );
  }

  if (maintenanceQuery.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => maintenanceQuery.refetch()} variant="secondary">
            Retry
          </Button>
        }
        description="We couldn't load this vehicle's service records. Try again in a moment."
        title="Unable to load service records"
      />
    );
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <>
          <MaintenanceImportDialog
            onOpenChange={setIsImportOpen}
            open={isImportOpen}
            vehicleId={vehicleId}
          />
          <div className="flex justify-end">
            <Button onClick={() => setIsImportOpen(true)} type="button" variant="outline">
              Import CSV
            </Button>
          </div>
        </>
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

      <div>
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
                  <Button onClick={() => setIsImportOpen(true)} type="button" variant="outline">
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
      </div>
    </div>
  );
}
