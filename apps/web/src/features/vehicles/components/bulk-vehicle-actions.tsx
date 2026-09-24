import { CarFront, Trash2 } from 'lucide-react';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Button } from '@/components/ui/button';

import type { Vehicle } from '../types/vehicle';
import { getVehicleDisplayName } from '../utils/get-vehicle-display-name';

export type SelectedVehicleSummary = Pick<
  Vehicle,
  'id' | 'make' | 'model' | 'nickname' | 'registrationNumber'
>;

type BulkVehicleActionsProps = {
  selectedVehicles: SelectedVehicleSummary[];
  visibleCount: number;
  isDeleting?: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => Promise<void> | void;
  onSelectAllVisible: () => void;
};

export function BulkVehicleActions({
  selectedVehicles,
  visibleCount,
  isDeleting = false,
  onClearSelection,
  onDeleteSelected,
  onSelectAllVisible,
}: BulkVehicleActionsProps) {
  const selectedCount = selectedVehicles.length;
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-surface p-4 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border/70 bg-page p-2">
            <CarFront className="h-4 w-4 text-fg-2" />
          </div>
          <div className="space-y-1">
            <p className="text-ui font-semibold text-fg">
              {hasSelection
                ? `${selectedCount} vehicle${selectedCount === 1 ? '' : 's'} selected`
                : 'Select vehicles to take action'}
            </p>
            <p className="text-ui text-muted-foreground">
              {hasSelection
                ? 'Deleting vehicles also removes linked service records, reminders, and receipts.'
                : `You can select all ${visibleCount} visible vehicles from the current filtered view.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSelectAllVisible} size="sm" type="button" variant="outline">
            Select all visible
          </Button>
          {hasSelection ? (
            <>
              <Button onClick={onClearSelection} size="sm" type="button" variant="ghost">
                Clear selection
              </Button>
              <ConfirmActionDialog
                confirmLabel={`Delete ${selectedCount} vehicle${selectedCount === 1 ? '' : 's'}`}
                description="This removes the selected vehicles and all linked service history, reminders, and receipts."
                isPending={isDeleting}
                onConfirm={onDeleteSelected}
                title="Delete selected vehicles?"
                triggerIcon={<Trash2 className="mr-2 h-4 w-4" />}
                triggerLabel={`Delete selected (${selectedCount})`}
                triggerVariant="outline"
              >
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-page p-3 text-ui">
                  {selectedVehicles.map((vehicle) => (
                    <li
                      className="flex items-center justify-between gap-3 text-fg-2"
                      key={vehicle.id}
                    >
                      <span className="truncate font-medium text-fg">
                        {getVehicleDisplayName(vehicle)}
                      </span>
                      <span className="shrink-0 tabular-nums text-fg-3">
                        {vehicle.registrationNumber}
                      </span>
                    </li>
                  ))}
                </ul>
              </ConfirmActionDialog>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
