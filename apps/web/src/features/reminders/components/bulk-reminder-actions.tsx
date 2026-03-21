import { CheckCheck, ListChecks, Trash2 } from 'lucide-react';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Button } from '@/components/ui/button';

type BulkReminderActionsProps = {
  selectedCount: number;
  selectedCompletableCount: number;
  visibleCount: number;
  isCompleting?: boolean;
  isDeleting?: boolean;
  onClearSelection: () => void;
  onCompleteSelected: () => Promise<void> | void;
  onDeleteSelected: () => Promise<void> | void;
  onSelectAllVisible: () => void;
};

export function BulkReminderActions({
  selectedCount,
  selectedCompletableCount,
  visibleCount,
  isCompleting = false,
  isDeleting = false,
  onClearSelection,
  onCompleteSelected,
  onDeleteSelected,
  onSelectAllVisible,
}: BulkReminderActionsProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border/70 bg-slate-50 p-2">
            <ListChecks className="h-4 w-4 text-slate-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-950">
              {hasSelection
                ? `${selectedCount} reminder${selectedCount === 1 ? '' : 's'} selected`
                : 'Select reminders to take action'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasSelection
                ? 'Mark selected reminders as completed or remove them in one step.'
                : `You can select all ${visibleCount} visible reminders from the current filtered view.`}
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
              <Button
                disabled={selectedCompletableCount === 0 || isCompleting || isDeleting}
                onClick={() => {
                  void onCompleteSelected();
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                {isCompleting
                  ? 'Completing...'
                  : `Mark completed${selectedCompletableCount > 0 ? ` (${selectedCompletableCount})` : ''}`}
              </Button>
              <ConfirmActionDialog
                confirmLabel={`Delete ${selectedCount} reminder${selectedCount === 1 ? '' : 's'}`}
                description="This removes the selected reminders from your garage and cannot be undone."
                isPending={isDeleting}
                onConfirm={onDeleteSelected}
                title="Delete selected reminders?"
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
