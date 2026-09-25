import { useEffect, useMemo, useState } from 'react';
import type { HistoryPage } from '@vehicle-vault/shared';

import { Money } from '@/components/shared/money';
import { Button } from '@/components/ui/button';
import { AccessoryEditor } from '@/features/accessories/components/accessory-editor';
import { BulkMaintenanceActions } from '@/features/maintenance/components/bulk-maintenance-actions';
import { useBulkDeleteMaintenanceRecords } from '@/features/maintenance/hooks/use-bulk-delete-maintenance-records';
import { accessFor } from '@/features/vehicles/context/vehicle-access';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import type { useHistory } from '../hooks/use-history';
import { groupHistory, monthStart } from '../utils/group-history';
import { HistoryRow, type HistoryVehicle } from './history-row';

/**
 * The services on these pages that the signed-in user may delete: services
 * only (a fill or a reading is not a record), on a vehicle they own or edit.
 */
export function selectableServiceIds(
  pages: HistoryPage[],
  vehicleById: Map<string, HistoryVehicle>,
): string[] {
  return pages.flatMap((page) =>
    page.entries.flatMap((entry) =>
      entry.kind === 'service' &&
      accessFor(vehicleById.get(entry.vehicleId)?.currentUserRole ?? null).canEdit
        ? [entry.id]
        : [],
    ),
  );
}

type HistoryTimelineProps = {
  query: ReturnType<typeof useHistory>;
  vehicleById: Map<string, HistoryVehicle>;
  showVehicle: boolean;
  /** Select mode, turned on by the page's Select button. */
  selecting?: boolean;
  /** Called once the selected services are deleted, to leave select mode. */
  onSelectingDone?: () => void;
};

/**
 * The timeline itself, newest first and grouped by month with each month's
 * spend in its header, then "Show older entries". The History page and a
 * vehicle's History tab both list it; the caller owns the query, its filters,
 * and the loading, error and empty states around it.
 *
 * In select mode service rows take a checkbox, and the selected ones delete
 * together through the existing endpoint.
 */
export function HistoryTimeline({
  query,
  vehicleById,
  showVehicle,
  selecting = false,
  onSelectingDone,
}: HistoryTimelineProps) {
  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const groups = useMemo(() => groupHistory(pages), [pages]);
  const selectableIds = useMemo(
    () => selectableServiceIds(pages, vehicleById),
    [pages, vehicleById],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ vehicleId: string; accessoryId: string } | null>(null);
  const bulkDelete = useBulkDeleteMaintenanceRecords();

  // Leaving select mode clears it, and a row that is no longer listed (a new
  // filter, a delete elsewhere) drops out. Returning `current` when nothing
  // changed keeps the state, so a re-render does not loop.
  useEffect(() => {
    setSelectedIds((current) => {
      const kept = selecting ? current.filter((id) => selectableIds.includes(id)) : [];
      return kept.length === current.length ? current : kept;
    });
  }, [selectableIds, selecting]);

  function toggle(recordId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(recordId)
          ? current
          : [...current, recordId]
        : current.filter((id) => id !== recordId),
    );
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    try {
      await bulkDelete.mutateAsync(ids);
      appToast.success({
        title: 'Service records deleted',
        description: `Deleted ${ids.length} service record${ids.length === 1 ? '' : 's'}.`,
      });
      setSelectedIds([]);
      onSelectingDone?.();
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
    <div className="space-y-4">
      {editing ? <AccessoryEditor onClose={() => setEditing(null)} target={editing} /> : null}
      {selecting ? (
        <BulkMaintenanceActions
          isDeleting={bulkDelete.isPending}
          onClearSelection={() => setSelectedIds([])}
          onDeleteSelected={deleteSelected}
          onSelectAllVisible={() => setSelectedIds(selectableIds)}
          selectedCount={selectedIds.length}
          visibleCount={selectableIds.length}
        />
      ) : null}

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {groups.map((group) => {
          const headingId = `history-${group.month}`;

          return (
            <section
              aria-labelledby={headingId}
              className="border-t border-line-subtle first:border-t-0"
              data-testid="history-month"
              key={group.month}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-subtle bg-page/60 px-4 py-2.5 sm:px-5">
                <h2 className="font-display text-lead font-semibold text-fg" id={headingId}>
                  {format.date(monthStart(group.month), 'monthYearLong')}
                </h2>
                <p className="text-small text-fg-2" data-testid="history-month-total">
                  {group.total !== null ? (
                    <>
                      Spent <Money className="font-semibold text-fg" value={group.total} />
                    </>
                  ) : null}
                  {group.total !== null && group.draftCount > 0 ? ' · ' : null}
                  {group.draftCount > 0
                    ? `${group.draftCount} draft${group.draftCount === 1 ? '' : 's'} not counted`
                    : null}
                </p>
              </div>
              <ul className="divide-y divide-line-subtle">
                {group.entries.map((entry) => (
                  <HistoryRow
                    entry={entry}
                    key={`${entry.kind}:${entry.id}`}
                    selection={
                      selecting
                        ? {
                            selectable: selectableIds.includes(entry.id),
                            selected: selectedIds.includes(entry.id),
                            onSelectedChange: (checked) => toggle(entry.id, checked),
                          }
                        : undefined
                    }
                    onOpenAccessory={
                      entry.kind === 'accessory' &&
                      accessFor(vehicleById.get(entry.vehicleId)?.currentUserRole ?? null).canEdit
                        ? (accessoryId) => setEditing({ vehicleId: entry.vehicleId, accessoryId })
                        : undefined
                    }
                    showVehicle={showVehicle}
                    vehicle={vehicleById.get(entry.vehicleId)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {query.hasNextPage ? (
          <div className="flex justify-center border-t border-line-subtle px-4 py-4">
            <Button
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
              type="button"
              variant="outline"
            >
              {query.isFetchingNextPage ? 'Loading older entries…' : 'Show older entries'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
