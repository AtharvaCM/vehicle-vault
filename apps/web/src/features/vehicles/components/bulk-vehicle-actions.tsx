import { CarFront, Trash2 } from 'lucide-react';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Button } from '@/components/ui/button';

type BulkVehicleActionsProps = {
  selectedCount: number;
  visibleCount: number;
  isDeleting?: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => Promise<void> | void;
  onSelectAllVisible: () => void;
};

export function BulkVehicleActions({
  selectedCount,
  visibleCount,
  isDeleting = false,
  onClearSelection,
  onDeleteSelected,
  onSelectAllVisible,
}: BulkVehicleActionsProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border/70 bg-slate-50 p-2">
            <CarFront className="h-4 w-4 text-slate-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-950">
              {hasSelection
                ? `${selectedCount} vehicle${selectedCount === 1 ? '' : 's'} selected`
                : 'Select vehicles to take action'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasSelection
                ? 'Deleting vehicles also removes linked maintenance records, reminders, and receipts.'
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
                description="This removes the selected vehicles and all linked maintenance history, reminders, and receipts."
                isPending={isDeleting}
                onConfirm={onDeleteSelected}
                title="Delete selected vehicles?"
                triggerIcon={<Trash2 className="mr-2 h-4 w-4" />}
                triggerLabel={`Delete selected (${selectedCount})`}
                triggerVariant="outline"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
