import { ClipboardList, ReceiptText, TrendingUp, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { VehiclePickerDialog } from '@/features/vehicles/components/vehicle-picker-dialog';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import type { Vehicle } from '@/features/vehicles/types/vehicle';

import { BulkMaintenanceActions } from '../components/bulk-maintenance-actions';
import { MaintenanceListControls } from '../components/maintenance-list-controls';
import { MaintenanceRecordList } from '../components/maintenance-record-list';
import { useBulkDeleteMaintenanceRecords } from '../hooks/use-bulk-delete-maintenance-records';
import { useAllMaintenanceRecords } from '../hooks/use-all-maintenance-records';
import type { MaintenanceRecord } from '../types/maintenance-record';
import { filterAndSortMaintenanceRecords } from '../utils/filter-and-sort-maintenance-records';
import { summarizeMaintenanceHistory } from '../utils/summarize-maintenance-history';
import {
  defaultMaintenanceSort,
  type MaintenanceListSearch,
  type MaintenanceSortOption,
} from '../types/maintenance-list-search';

const EMPTY_MAINTENANCE_RECORDS: MaintenanceRecord[] = [];
const EMPTY_VEHICLES: Vehicle[] = [];

type MaintenanceOverviewPageProps = {
  searchState: MaintenanceListSearch;
  onSearchStateChange: (next: Partial<MaintenanceListSearch>) => void;
};

export function MaintenanceOverviewPage({
  searchState,
  onSearchStateChange,
}: MaintenanceOverviewPageProps) {
  const maintenanceQuery = useAllMaintenanceRecords();
  const vehiclesQuery = useVehicles();
  const bulkDeleteMutation = useBulkDeleteMaintenanceRecords();
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const searchValue = searchState.search ?? '';
  const category = searchState.category ?? 'all';
  const sortBy: MaintenanceSortOption = searchState.sort ?? defaultMaintenanceSort;
  const records = maintenanceQuery.data ?? EMPTY_MAINTENANCE_RECORDS;
  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;

  const vehicleLabelById = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((vehicle) => [
          vehicle.id,
          `${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} • ${vehicle.registrationNumber}`,
        ]),
      ),
    [vehicles],
  );

  const filteredRecords = useMemo(
    () =>
      filterAndSortMaintenanceRecords({
        records,
        searchValue,
        category,
        sortBy,
        vehicleLabelById,
      }),
    [category, records, searchValue, sortBy, vehicleLabelById],
  );
  const visibleRecordIds = useMemo(
    () => filteredRecords.map((record) => record.id),
    [filteredRecords],
  );

  useEffect(() => {
    setSelectedRecordIds((current) =>
      current.filter((recordId) => visibleRecordIds.includes(recordId)),
    );
  }, [visibleRecordIds]);

  if (maintenanceQuery.isPending || vehiclesQuery.isPending) {
    return (
      <PageContainer>
        <PageHeader
          description="Review service history across every vehicle in your garage."
          title="Maintenance"
        />
        <LoadingState
          description="Loading service records across your garage."
          title="Loading service records"
        />
      </PageContainer>
    );
  }

  if (maintenanceQuery.isError || vehiclesQuery.isError) {
    return (
      <PageContainer>
        <PageHeader
          description="Review service history across every vehicle in your garage."
          title="Maintenance"
        />
        <ErrorState
          action={
            <Button
              onClick={() => {
                void maintenanceQuery.refetch();
                void vehiclesQuery.refetch();
              }}
              variant="secondary"
            >
              Retry
            </Button>
          }
          description="We couldn't load your service records. Try again in a moment."
          title="Unable to load service records"
        />
      </PageContainer>
    );
  }

  const { recordCount, draftCount, vehiclesWithHistory, totalSpend, latestServiceDate } =
    summarizeMaintenanceHistory(records);

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

  return (
    <PageContainer>
      <PageHeader
        actions={
          <VehiclePickerDialog
            buildLink={(vehicleId) => ({
              to: '/vehicles/$vehicleId/maintenance/new',
              params: { vehicleId },
            })}
            dialogDescription="Choose which vehicle this service is for."
            dialogTitle="Log service"
            isLoading={vehiclesQuery.isPending}
            triggerLabel="Log service"
            vehicles={vehicles}
          />
        }
        description="Review service history across your garage, then open any entry for full details and receipts."
        title="Maintenance"
      />

      {records.length ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <StatCard
              accent={
                draftCount > 0 ? (
                  <span className="text-xs font-medium text-soon">
                    {draftCount} draft{draftCount === 1 ? '' : 's'} to confirm
                  </span>
                ) : null
              }
              description="Service records logged across your garage."
              icon={ClipboardList}
              label="Records"
              value={String(recordCount)}
            />
            <StatCard
              description="Vehicles that already have at least one service record."
              icon={Wrench}
              label="Vehicles with history"
              value={String(vehiclesWithHistory)}
            />
            <StatCard
              accent={
                latestServiceDate ? (
                  <span className="text-xs font-medium text-fg-3">
                    Latest {format.date(latestServiceDate)}
                  </span>
                ) : null
              }
              description="Total recorded maintenance spend across all vehicles."
              icon={ReceiptText}
              label="Recorded spend"
              value={format.money(totalSpend)}
            />
          </div>

          <MaintenanceListControls
            category={category}
            onCategoryChange={(value) => onSearchStateChange({ category: value })}
            onReset={resetControls}
            onSearchChange={(value) => onSearchStateChange({ search: value || undefined })}
            onSortChange={(value) => onSearchStateChange({ sort: value })}
            resultCount={filteredRecords.length}
            searchPlaceholder="Search by vehicle, workshop, notes, or category"
            searchValue={searchValue}
            sortBy={sortBy}
            totalCount={records.length}
          />

          <BulkMaintenanceActions
            isDeleting={bulkDeleteMutation.isPending}
            onClearSelection={() => setSelectedRecordIds([])}
            onDeleteSelected={handleBulkDelete}
            onSelectAllVisible={() => setSelectedRecordIds(visibleRecordIds)}
            selectedCount={selectedRecordIds.length}
            visibleCount={visibleRecordIds.length}
          />

          <SectionCard
            className="p-3 sm:p-5"
            description="Browse every logged service record across your vehicles."
            title="All service records"
            action={
              <div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>{filteredRecords.length} visible</span>
              </div>
            }
          >
            {filteredRecords.length ? (
              <MaintenanceRecordList
                onSelectionChange={handleSelectionChange}
                records={filteredRecords}
                selectedRecordIds={selectedRecordIds}
                title="Service records"
                vehicleLabelById={vehicleLabelById}
              />
            ) : (
              <EmptyState
                action={
                  <Button onClick={resetControls} variant="secondary">
                    Clear filters
                  </Button>
                }
                description="Try broadening the search or removing the active category filter."
                icon={ClipboardList}
                title="No service records match these filters"
              />
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          description="Service records from across your tracked vehicles will appear here."
          title="Latest service activity"
        >
          <EmptyState
            action={
              <VehiclePickerDialog
                addVehicleLabel="Add vehicle"
                buildLink={(vehicleId) => ({
                  to: '/vehicles/$vehicleId/maintenance/new',
                  params: { vehicleId },
                })}
                dialogDescription="Choose which vehicle this service is for."
                dialogTitle="Log service"
                isLoading={vehiclesQuery.isPending}
                triggerLabel="Log service from a vehicle"
                vehicles={vehicles}
              />
            }
            description="Your service records will appear here once you log the first visit or repair."
            icon={ClipboardList}
            title="No service records yet"
          />
        </SectionCard>
      )}
    </PageContainer>
  );
}
