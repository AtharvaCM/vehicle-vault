import { Link } from '@tanstack/react-router';
import { ClipboardList, ReceiptText, TrendingUp, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MaintenanceCategory } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { StatCard } from '@/components/shared/stat-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import type { Vehicle } from '@/features/vehicles/types/vehicle';

import {
  MaintenanceListControls,
  type MaintenanceSortOption,
} from '../components/maintenance-list-controls';
import { MaintenanceRecordList } from '../components/maintenance-record-list';
import { useAllMaintenanceRecords } from '../hooks/use-all-maintenance-records';
import type { MaintenanceRecord } from '../types/maintenance-record';
import { filterAndSortMaintenanceRecords } from '../utils/filter-and-sort-maintenance-records';

const EMPTY_MAINTENANCE_RECORDS: MaintenanceRecord[] = [];
const EMPTY_VEHICLES: Vehicle[] = [];

export function MaintenanceOverviewPage() {
  const maintenanceQuery = useAllMaintenanceRecords();
  const vehiclesQuery = useVehicles();
  const [searchValue, setSearchValue] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<MaintenanceSortOption>('service-date-desc');
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

  if (maintenanceQuery.isPending || vehiclesQuery.isPending) {
    return (
      <PageContainer>
        <PageHeader
          description="Review logged service work across every tracked vehicle."
          title="Maintenance"
        />
        <LoadingState
          description="Fetching maintenance history from the backend."
          title="Loading maintenance history"
        />
      </PageContainer>
    );
  }

  if (maintenanceQuery.isError || vehiclesQuery.isError) {
    return (
      <PageContainer>
        <PageHeader
          description="Review logged service work across every tracked vehicle."
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
          description="Maintenance history could not be loaded right now. Try again after the API is reachable."
          title="Unable to load maintenance"
        />
      </PageContainer>
    );
  }

  const totalSpend = records.reduce((sum, record) => sum + record.totalCost, 0);
  const vehiclesWithHistory = new Set(records.map((record) => record.vehicleId)).size;
  const latestRecord = records
    .slice()
    .sort((left, right) => Date.parse(right.serviceDate) - Date.parse(left.serviceDate))[0];
  const latestServiceDate = latestRecord?.serviceDate ?? null;

  function resetControls() {
    setSearchValue('');
    setCategory('all');
    setSortBy('service-date-desc');
  }

  return (
    <PageContainer>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: 'outline' })} to="/vehicles">
              Choose a vehicle
            </Link>
            <Link className={buttonVariants()} to="/vehicles">
              Log maintenance from vehicle
            </Link>
          </div>
        }
        description="Track service history across the whole garage, then drill into a specific maintenance record when you need the full detail and attachments."
        title="Maintenance"
      />

      {records.length ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <StatCard
              description="Total maintenance records currently stored for your garage."
              icon={ClipboardList}
              label="Records"
              value={String(records.length)}
            />
            <StatCard
              description="Vehicles that already have at least one logged service event."
              icon={Wrench}
              label="Vehicles with history"
              value={String(vehiclesWithHistory)}
            />
            <StatCard
              accent={
                latestServiceDate ? (
                  <span className="text-xs font-medium text-slate-500">
                    Latest {formatDate(latestServiceDate)}
                  </span>
                ) : null
              }
              description="Combined spend across all maintenance records in your account."
              icon={ReceiptText}
              label="Recorded spend"
              value={formatCurrency(totalSpend)}
            />
          </div>

          <MaintenanceListControls
            category={category}
            onCategoryChange={setCategory}
            onReset={resetControls}
            onSearchChange={setSearchValue}
            onSortChange={setSortBy}
            resultCount={filteredRecords.length}
            searchPlaceholder="Search by vehicle, workshop, notes, or category"
            searchValue={searchValue}
            sortBy={sortBy}
            totalCount={records.length}
          />

          <SectionCard
            description="Review and open any service record across your tracked vehicles."
            title="All maintenance records"
            action={
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>{filteredRecords.length} visible</span>
              </div>
            }
          >
            {filteredRecords.length ? (
              <MaintenanceRecordList
                records={filteredRecords}
                title="Maintenance history"
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
                title="No maintenance records match these filters"
              />
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          description="Maintenance records from across your tracked vehicles will appear here."
          title="Latest maintenance activity"
        >
          <EmptyState
            action={
              <Link className={buttonVariants()} to="/vehicles">
                Log maintenance from a vehicle
              </Link>
            }
            description="Maintenance records will appear here as soon as you log your first service event."
            icon={ClipboardList}
            title="No maintenance records yet"
          />
        </SectionCard>
      )}
    </PageContainer>
  );
}
