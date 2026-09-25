import { Link } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button, buttonVariants } from '@/components/ui/button';
import type { HistoryVehicle } from '@/features/history/components/history-row';
import { HistorySearchBox } from '@/features/history/components/history-search-box';
import { HistoryTimeline } from '@/features/history/components/history-timeline';
import { useHistory } from '@/features/history/hooks/use-history';
import { MaintenanceImportDialog } from '@/features/maintenance/components/maintenance-import-dialog';

import { useVehicleAccess } from '../context/vehicle-access';

type VehicleServiceHistoryProps = {
  vehicle: HistoryVehicle;
  /** The search in the URL; see `VehicleDetailSearch.search`. */
  search: string | undefined;
  onSearchChange: (search: string | undefined) => void;
};

/**
 * The vehicle's service log: the History page's list with this vehicle and
 * services preset, so both read and behave the same. Search, Select (bulk
 * delete) and Import CSV sit above it; the last two are for those who edit.
 */
export function VehicleServiceHistory({
  vehicle,
  search,
  onSearchChange,
}: VehicleServiceHistoryProps) {
  const { canEdit, role } = useVehicleAccess();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const historyQuery = useHistory({ vehicleId: vehicle.id, kind: 'service', search });
  // The page's role is the one to trust: the vehicle's own field is omitted by
  // older API versions.
  const vehicleById = useMemo(
    () => new Map([[vehicle.id, { ...vehicle, currentUserRole: role ?? vehicle.currentUserRole }]]),
    [role, vehicle],
  );
  const hasEntries = Boolean(historyQuery.data?.pages.some((page) => page.entries.length > 0));
  const showControls = hasEntries || Boolean(search);

  const importButton = canEdit ? (
    <Button onClick={() => setIsImportOpen(true)} type="button" variant="outline">
      Import CSV
    </Button>
  ) : null;

  function body() {
    if (historyQuery.isPending) {
      return (
        <LoadingState
          description="Loading service records for this vehicle."
          title="Loading service records"
        />
      );
    }

    if (historyQuery.isError) {
      return (
        <ErrorState
          action={
            <Button onClick={() => void historyQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load this vehicle's service records. Try again in a moment."
          title="Unable to load service records"
        />
      );
    }

    if (!hasEntries) {
      return search ? (
        <EmptyState
          action={
            <Button onClick={() => onSearchChange(undefined)} variant="secondary">
              Clear search
            </Button>
          }
          description={`No service on this vehicle matches “${search}”. Try other words.`}
          icon={ClipboardList}
          title="No services match"
        />
      ) : (
        <EmptyState
          action={
            canEdit ? (
              <div className="flex flex-wrap gap-2">
                {importButton}
                <Link
                  className={buttonVariants()}
                  params={{ vehicleId: vehicle.id }}
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
          icon={ClipboardList}
          title="No service records yet"
        />
      );
    }

    return (
      <HistoryTimeline
        onSelectingDone={() => setIsSelecting(false)}
        query={historyQuery}
        selecting={isSelecting}
        showVehicle={false}
        vehicleById={vehicleById}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="vehicle-service-history">
      {canEdit ? (
        <MaintenanceImportDialog
          onOpenChange={setIsImportOpen}
          open={isImportOpen}
          vehicleId={vehicle.id}
        />
      ) : null}
      {showControls ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <HistorySearchBox
            onChange={onSearchChange}
            placeholder="Search work, workshop or notes"
            value={search}
          />
          <div className="flex gap-2 sm:ml-auto">
            {canEdit && (hasEntries || isSelecting) ? (
              <Button
                aria-pressed={isSelecting}
                onClick={() => setIsSelecting((current) => !current)}
                type="button"
                variant="outline"
              >
                {isSelecting ? 'Done' : 'Select'}
              </Button>
            ) : null}
            {importButton}
          </div>
        </div>
      ) : null}
      {body()}
    </div>
  );
}
