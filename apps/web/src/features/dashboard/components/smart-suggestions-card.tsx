import { Link } from '@tanstack/react-router';
import type { MaintenanceSuggestion } from '@vehicle-vault/shared';

import { SectionCard } from '@/components/shared/section-card';
import { StatusPill } from '@/components/shared/status-pill';
import { buttonVariants } from '@/components/ui/button';
import { format } from '@/lib/format';

type SmartSuggestionsCardProps = {
  insights: MaintenanceSuggestion[];
};

function MetaDot() {
  return <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />;
}

export function SmartSuggestionsCard({ insights }: SmartSuggestionsCardProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <SectionCard
      contentClassName="pt-0"
      description="Based on each vehicle's service intervals and driving pace."
      title="Smart suggestions"
    >
      <div className="divide-y divide-slate-100">
        {insights.map((insight) => {
          const meta = [
            insight.vehicleLabel,
            insight.estimatedDateDue ? `~${format.date(insight.estimatedDateDue)}` : undefined,
            insight.estimatedOdometerDue !== undefined
              ? `~${format.odometer(insight.estimatedOdometerDue)}`
              : undefined,
          ].filter((value): value is string => Boolean(value));

          return (
            <div
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              key={`${insight.vehicleId ?? 'garage'}-${insight.category}`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate font-semibold text-slate-900">
                    {format.enumLabel('maintenanceCategory', insight.category)}
                  </p>
                  {insight.priority === 'high' ? (
                    <StatusPill className="shrink-0" status="soon">
                      Soon
                    </StatusPill>
                  ) : (
                    <StatusPill className="shrink-0" status="info">
                      Upcoming
                    </StatusPill>
                  )}
                </div>
                {meta.length > 0 ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
                    {meta.map((segment, index) => (
                      <span className="flex items-center gap-x-2 tabular-nums" key={segment}>
                        {index > 0 ? <MetaDot /> : null}
                        {segment}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="line-clamp-2 text-xs text-slate-500">{insight.reason}</p>
              </div>
              {insight.vehicleId ? (
                <div className="flex shrink-0 gap-2">
                  <Link
                    className={buttonVariants({ size: 'sm', variant: 'outline' })}
                    params={{ vehicleId: insight.vehicleId }}
                    to="/vehicles/$vehicleId/maintenance/new"
                  >
                    Log service
                  </Link>
                  <Link
                    className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                    params={{ vehicleId: insight.vehicleId }}
                    to="/vehicles/$vehicleId/reminders/new"
                  >
                    Remind me
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
