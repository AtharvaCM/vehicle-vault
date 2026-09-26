import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ListChecks, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { queryKeys } from '@/lib/query/query-keys';

import {
  applyServiceSchedule,
  serviceScheduleSuggestionsQueryOptions,
} from '../api/service-schedule';
import type { ServiceScheduleSuggestion } from '../types/service-schedule';

type Props = {
  vehicleId: string;
  /**
   * Starts as one "Suggested schedule" row that opens the panel: for a vehicle
   * whose reminders are already on file and should come first.
   */
  collapsed?: boolean;
};

export function ServiceSchedulePanel({ vehicleId, collapsed = false }: Props) {
  const { canEdit } = useVehicleAccess();
  const [isOpen, setIsOpen] = useState(!collapsed);
  const queryClient = useQueryClient();
  const suggestionsQuery = useQuery(serviceScheduleSuggestionsQueryOptions(vehicleId));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const applyMutation = useMutation({
    mutationFn: (slugs: string[]) => applyServiceSchedule(vehicleId, slugs),
    onSuccess: async (result) => {
      appToast.success({
        title: `Added ${result.created.length} reminder${result.created.length === 1 ? '' : 's'}`,
        description: 'They now appear in your reminders list.',
      });
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.reminders.byVehicle(vehicleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reminders.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.reminders.scheduleSuggestions(vehicleId),
        }),
      ]);
    },
    onError: (error) => {
      appToast.error({
        title: 'Could not add reminders',
        description: getApiErrorMessage(error),
      });
    },
  });

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  if (!isOpen) {
    const toAdd = suggestionsQuery.data?.filter((item) => !item.alreadyScheduled).length ?? 0;

    return (
      <button
        aria-expanded={false}
        className="flex w-full items-center gap-3 rounded-card border border-line/60 bg-surface px-4 py-3 text-left transition-colors hover:bg-page"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Sparkles aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 text-ui font-semibold text-fg">Suggested schedule</span>
        {toAdd > 0 ? <span className="text-caption text-fg-3">{toAdd} not added yet</span> : null}
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-3" />
      </button>
    );
  }

  if (suggestionsQuery.isLoading) {
    return (
      <Card className="border-line/60 bg-surface">
        <CardHeader className="border-b border-line-subtle pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <CardTitle className="text-lead font-bold">Suggested service schedule</CardTitle>
          </div>
          <CardDescription>Loading recommended intervals…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (suggestionsQuery.isError || !suggestionsQuery.data) {
    return null;
  }

  const items = suggestionsQuery.data;
  const actionable = items.filter((item) => !item.alreadyScheduled);

  return (
    <Card className="border-line/60 bg-surface">
      <CardHeader className="border-b border-line-subtle pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <CardTitle className="text-lead font-bold">Suggested service schedule</CardTitle>
          </div>
          {collapsed ? (
            <Button
              aria-expanded
              onClick={() => setIsOpen(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronUp aria-hidden="true" />
              Hide
            </Button>
          ) : (
            <Badge variant="outline">Typical intervals</Badge>
          )}
        </div>
        <CardDescription>
          {canEdit
            ? "Common maintenance items based on your vehicle's fuel type. Pick the ones to add as reminders — you can edit the date or odometer afterwards."
            : "Common maintenance items based on your vehicle's fuel type, and whether each one is already scheduled."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-5">
        {items.length === 0 ? (
          <p className="text-ui text-fg-3">No suggestions for this vehicle.</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {items.map((item) => {
              const disabled = item.alreadyScheduled;
              const checked = selected.has(item.slug);
              return (
                <li key={item.slug} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  {canEdit ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(item.slug)}
                      aria-label={`Add ${item.title}`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ui font-semibold text-fg">{item.title}</p>
                      <Badge variant="outline">{format.enumLabel('reminderType', item.type)}</Badge>
                      {disabled ? <Badge tone="success">Already scheduled</Badge> : null}
                    </div>
                    <p className="mt-1 text-caption text-fg-3">
                      {item.intervalKm != null ? (
                        <span>Every {format.distance(item.intervalKm)}</span>
                      ) : null}
                      {item.intervalKm != null && item.intervalMonths != null ? ' or ' : null}
                      {item.intervalMonths != null ? (
                        <span>{item.intervalMonths} months</span>
                      ) : null}
                      {!item.anchor && (item.dueOdometer != null || item.dueDate)
                        ? ` • Next: ${nextDue(item)}`
                        : null}
                    </p>
                    {item.anchor && (item.dueOdometer != null || item.dueDate) ? (
                      <p className="mt-0.5 text-caption text-fg-3">
                        {describeAnchor(item.anchor)} → next {nextDue(item)}
                      </p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-1 text-caption italic text-fg-3">{item.notes}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && actionable.length > 0 ? (
          <div className="flex items-center justify-between border-t border-line-subtle pt-4">
            <p className="text-caption text-fg-3">
              <ListChecks className="mr-1 inline h-3 w-3" />
              {selected.size} selected
            </p>
            <Button
              size="sm"
              disabled={selected.size === 0 || applyMutation.isPending}
              onClick={() => applyMutation.mutate(Array.from(selected))}
            >
              {applyMutation.isPending
                ? 'Adding…'
                : `Add ${selected.size} reminder${selected.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function nextDue(item: ServiceScheduleSuggestion): string {
  return [
    item.dueOdometer != null ? format.odometer(item.dueOdometer) : null,
    item.dueDate ? format.date(item.dueDate) : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

/**
 * Says what the next due was counted from, so a reminder added from this row is
 * never silently later than the service it follows.
 */
function describeAnchor(anchor: NonNullable<ServiceScheduleSuggestion['anchor']>): string {
  if (anchor.source === 'now') return 'No history — counted from today';

  const when = anchor.lastDoneDate ? ` ${format.date(anchor.lastDoneDate)}` : '';
  const where =
    anchor.lastDoneOdometer != null ? ` at ${format.odometer(anchor.lastDoneOdometer)}` : '';
  const verb = anchor.source === 'tyre_check' ? 'Last checked' : 'Last done';

  return `${verb}${when}${where}`;
}
