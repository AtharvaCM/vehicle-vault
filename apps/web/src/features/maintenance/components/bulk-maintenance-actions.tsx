import { ListChecks, Trash2 } from 'lucide-react';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Button } from '@/components/ui/button';

type BulkMaintenanceActionsProps = {
  selectedCount: number;
  visibleCount: number;
  isDeleting?: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => Promise<void> | void;
  onSelectAllVisible: () => void;
};

export function BulkMaintenanceActions({
  selectedCount,
  visibleCount,
  isDeleting = false,
  onClearSelection,
  onDeleteSelected,
  onSelectAllVisible,
}: BulkMaintenanceActionsProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-surface p-4 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border/70 bg-page p-2">
            <ListChecks className="h-4 w-4 text-fg-2" />
          </div>
          <div className="space-y-1">
            <p className="text-ui font-semibold text-fg">
              {hasSelection
                ? `${selectedCount} record${selectedCount === 1 ? '' : 's'} selected`
                : 'Select service records to take action'}
            </p>
            <p className="text-ui text-muted-foreground">
              {hasSelection
                ? 'Delete selected service records in one step.'
                : `You can select all ${visibleCount} visible service records from the current filtered view.`}
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
                confirmLabel={`Delete ${selectedCount} record${selectedCount === 1 ? '' : 's'}`}
                description="This removes the selected service records and any linked receipts from your garage."
                isPending={isDeleting}
                onConfirm={onDeleteSelected}
                title="Delete selected service records?"
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
