import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListChecks, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { queryKeys } from '@/lib/query/query-keys';
import { formatDate } from '@/lib/utils/format-date';

import {
  applyServiceSchedule,
  serviceScheduleSuggestionsQueryOptions,
} from '../api/service-schedule';
import { formatReminderType } from '../utils/format-reminder-type';

type Props = {
  vehicleId: string;
};

export function ServiceSchedulePanel({ vehicleId }: Props) {
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

  if (suggestionsQuery.isLoading) {
    return (
      <Card className="border-slate-200/60 bg-white shadow-premium-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Suggested service schedule</CardTitle>
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
    <Card className="border-slate-200/60 bg-white shadow-premium-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Suggested service schedule</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
            Generic intervals
          </Badge>
        </div>
        <CardDescription>
          Common maintenance items based on your vehicle&apos;s fuel type. Pick the ones to add as
          reminders — you can edit the date or odometer afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-5">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No suggestions for this vehicle.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const disabled = item.alreadyScheduled;
              const checked = selected.has(item.slug);
              return (
                <li
                  key={item.slug}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(item.slug)}
                    aria-label={`Add ${item.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold uppercase tracking-widest"
                      >
                        {formatReminderType(item.type)}
                      </Badge>
                      {disabled ? (
                        <Badge className="bg-emerald-100 text-[10px] uppercase tracking-widest text-emerald-700">
                          Already scheduled
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.intervalKm != null ? (
                        <span>Every {item.intervalKm.toLocaleString('en-IN')} km</span>
                      ) : null}
                      {item.intervalKm != null && item.intervalMonths != null ? ' or ' : null}
                      {item.intervalMonths != null ? (
                        <span>{item.intervalMonths} months</span>
                      ) : null}
                      {item.dueOdometer != null || item.dueDate ? ' • Next: ' : null}
                      {item.dueOdometer != null ? (
                        <span>{item.dueOdometer.toLocaleString('en-IN')} km</span>
                      ) : null}
                      {item.dueOdometer != null && item.dueDate ? ' / ' : null}
                      {item.dueDate ? <span>{formatDate(item.dueDate)}</span> : null}
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-xs italic text-slate-400">{item.notes}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {actionable.length > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              <ListChecks className="mr-1 inline h-3 w-3" />
              {selected.size} selected
            </p>
            <Button
              size="sm"
              disabled={selected.size === 0 || applyMutation.isPending}
              onClick={() => applyMutation.mutate(Array.from(selected))}
            >
              {applyMutation.isPending ? 'Adding…' : `Add ${selected.size} reminder${selected.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
