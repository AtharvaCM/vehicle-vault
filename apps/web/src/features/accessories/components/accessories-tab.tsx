import { useMemo, useState } from 'react';
import type { Accessory } from '@vehicle-vault/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/utils/format-currency';

import { useDeleteAccessory, useVehicleAccessories } from '../hooks/use-accessories';
import { AccessoryCard } from './accessory-card';
import { AccessoryFormDialog } from './accessory-form-dialog';

interface AccessoriesTabProps {
  vehicleId: string;
}

export function AccessoriesTab({ vehicleId }: AccessoriesTabProps) {
  const accessoriesQuery = useVehicleAccessories(vehicleId);
  const deleteMutation = useDeleteAccessory(vehicleId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Accessory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accessories = useMemo(() => accessoriesQuery.data ?? [], [accessoriesQuery.data]);
  const { fitted, notFitted, removed, totalSpend, spendCurrency } = useMemo(() => {
    // Three groups, not two: an accessory bought but not yet installed is not
    // "on the vehicle", and filing it there makes the heading a lie.
    const fittedItems = accessories.filter(
      (accessory) => accessory.removedDate == null && accessory.fittedDate != null,
    );
    const notFittedItems = accessories.filter(
      (accessory) => accessory.removedDate == null && accessory.fittedDate == null,
    );
    const removedItems = accessories.filter((accessory) => accessory.removedDate != null);

    // Summing across currencies would produce a number that means nothing, so
    // the total is only offered when every row agrees.
    const currencies = new Set(accessories.map((accessory) => accessory.currencyCode));
    const singleCurrency = currencies.size === 1 ? [...currencies][0] : null;
    const spend = singleCurrency
      ? accessories.reduce((sum, accessory) => sum + accessory.cost, 0)
      : null;

    return {
      fitted: fittedItems,
      notFitted: notFittedItems,
      removed: removedItems,
      totalSpend: spend,
      spendCurrency: singleCurrency,
    };
  }, [accessories]);

  function openCreate() {
    setEditing(null);
    setIsFormOpen(true);
  }

  function openEdit(accessory: Accessory) {
    setEditing(accessory);
    setIsFormOpen(true);
  }

  async function handleDelete(accessory: Accessory) {
    setDeletingId(accessory.id);
    try {
      await deleteMutation.mutateAsync(accessory.id);
      appToast.success({
        title: 'Accessory deleted',
        description: `${accessory.name} is no longer tracked on this vehicle.`,
      });
    } catch (error) {
      appToast.error({
        title: "Couldn't delete the accessory",
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (accessoriesQuery.isPending) {
    return <LoadingState description="Fetching what you have bought." title="Accessories" />;
  }

  if (accessoriesQuery.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => void accessoriesQuery.refetch()} size="sm" variant="secondary">
            Retry
          </Button>
        }
        description={getApiErrorMessage(
          accessoriesQuery.error,
          'The accessories could not be loaded.',
        )}
        title="Couldn't load accessories"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Accessories</h2>
          <p className="text-sm text-slate-500">
            {accessories.length > 0
              ? `${accessories.length} item${accessories.length === 1 ? '' : 's'}${
                  totalSpend != null
                    ? ` · ${formatCurrency(totalSpend, spendCurrency ?? undefined)} spent`
                    : ''
                }`
              : 'Things bought for this vehicle, kept out of your service history.'}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          Add accessory
        </Button>
      </div>

      {accessories.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={openCreate} size="sm">
              Add accessory
            </Button>
          }
          description="Mats, a dashcam, alloys — anything you bought for the car. Recorded separately from services so it does not distort your cost per kilometre."
          title="No accessories yet"
        />
      ) : (
        <div className="space-y-6">
          {fitted.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                On the vehicle
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {fitted.map((accessory) => (
                  <AccessoryCard
                    accessory={accessory}
                    isDeleting={deletingId === accessory.id}
                    key={accessory.id}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {notFitted.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Bought, not fitted
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {notFitted.map((accessory) => (
                  <AccessoryCard
                    accessory={accessory}
                    isDeleting={deletingId === accessory.id}
                    key={accessory.id}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {removed.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Removed
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {removed.map((accessory) => (
                  <AccessoryCard
                    accessory={accessory}
                    isDeleting={deletingId === accessory.id}
                    key={accessory.id}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <AccessoryFormDialog
        editingAccessory={editing}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        vehicleId={vehicleId}
      />
    </div>
  );
}
