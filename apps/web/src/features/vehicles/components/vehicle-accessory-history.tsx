import { Package, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { AccessoryFormDialog } from '@/features/accessories/components/accessory-form-dialog';
import type { HistoryVehicle } from '@/features/history/components/history-row';
import { HistorySearchBox } from '@/features/history/components/history-search-box';
import { HistoryTimeline } from '@/features/history/components/history-timeline';
import { useHistory } from '@/features/history/hooks/use-history';

import { useVehicleAccess } from '../context/vehicle-access';

type VehicleAccessoryHistoryProps = {
  vehicle: HistoryVehicle;
  /** The search in the URL; see `VehicleDetailSearch.search`. */
  search: string | undefined;
  onSearchChange: (search: string | undefined) => void;
};

/**
 * The vehicle's accessories (#336): the History list with this vehicle and
 * `kind: 'accessory'` preset, as the service log is. A row opens the accessory
 * to edit or delete it; Add accessory is here and in the header's Log menu.
 */
export function VehicleAccessoryHistory({
  vehicle,
  search,
  onSearchChange,
}: VehicleAccessoryHistoryProps) {
  const { canEdit, role } = useVehicleAccess();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const historyQuery = useHistory({ vehicleId: vehicle.id, kind: 'accessory', search });
  // The page's role is the one to trust: the vehicle's own field is omitted by
  // older API versions.
  const vehicleById = useMemo(
    () => new Map([[vehicle.id, { ...vehicle, currentUserRole: role ?? vehicle.currentUserRole }]]),
    [role, vehicle],
  );
  const hasEntries = Boolean(historyQuery.data?.pages.some((page) => page.entries.length > 0));

  const addButton = canEdit ? (
    <Button onClick={() => setIsAddOpen(true)} type="button" variant="outline">
      <Plus aria-hidden="true" />
      Add accessory
    </Button>
  ) : null;

  function body() {
    if (historyQuery.isPending) {
      return <LoadingState description="Loading this vehicle's accessories." title="Loading" />;
    }

    if (historyQuery.isError) {
      return (
        <ErrorState
          action={
            <Button onClick={() => void historyQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load this vehicle's accessories. Try again in a moment."
          title="Unable to load accessories"
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
          description={`No accessory on this vehicle matches “${search}”. Try other words.`}
          icon={Package}
          title="No accessories match"
        />
      ) : (
        <EmptyState
          action={addButton}
          description="A dashcam, mats, a phone mount: what you bought for it, with its receipt and warranty. It stays out of your running cost per km."
          icon={Package}
          title="No accessories yet"
        />
      );
    }

    return <HistoryTimeline query={historyQuery} showVehicle={false} vehicleById={vehicleById} />;
  }

  return (
    <div className="space-y-4" data-testid="vehicle-accessory-history">
      {canEdit && isAddOpen ? (
        <AccessoryFormDialog isOpen onClose={() => setIsAddOpen(false)} vehicleId={vehicle.id} />
      ) : null}
      {hasEntries || search ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <HistorySearchBox
            onChange={onSearchChange}
            placeholder="Search name, brand or notes"
            value={search}
          />
          <div className="flex gap-2 sm:ml-auto">{addButton}</div>
        </div>
      ) : null}
      {body()}
    </div>
  );
}
