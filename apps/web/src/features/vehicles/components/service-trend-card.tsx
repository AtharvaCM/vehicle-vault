import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { VehicleServiceInsights } from '../utils/get-vehicle-service-insights';

type ServiceTrendCardProps = {
  insights: VehicleServiceInsights;
};

export function ServiceTrendCard({ insights }: ServiceTrendCardProps) {
  const nextDueLabel = getNextDueLabel(insights);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service trend</CardTitle>
        <CardDescription>
          Use recent history to judge cadence, spend, and the next likely checkpoint.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <TrendMetric
          label="Average spend"
          value={insights.averageSpend !== null ? formatCurrency(insights.averageSpend) : 'Not enough data'}
        />
        <TrendMetric
          label="Average gap"
          value={
            insights.averageKmBetweenServices !== null
              ? `${Math.round(insights.averageKmBetweenServices).toLocaleString('en-IN')} km`
              : 'Not enough data'
          }
          detail={
            insights.averageDaysBetweenServices !== null
              ? `About every ${Math.round(insights.averageDaysBetweenServices)} days`
              : undefined
          }
        />
        <TrendMetric
          label="Since last service"
          value={
            insights.kmSinceLastService !== null
              ? `${insights.kmSinceLastService.toLocaleString('en-IN')} km`
              : 'No service logged yet'
          }
          detail={insights.latestService ? `Last service ${formatDate(insights.latestService.serviceDate)}` : undefined}
        />
        <TrendMetric
          label="Next due"
          value={nextDueLabel.value}
          detail={nextDueLabel.detail}
        />
      </CardContent>
    </Card>
  );
}

function TrendMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function getNextDueLabel(insights: VehicleServiceInsights) {
  if (insights.nextDueOdometerDelta !== null) {
    if (insights.nextDueOdometerDelta > 0) {
      return {
        value: `In ${insights.nextDueOdometerDelta.toLocaleString('en-IN')} km`,
        detail: 'Based on the latest logged next due odometer',
      };
    }

    if (insights.nextDueOdometerDelta === 0) {
      return {
        value: 'Due now',
        detail: 'Current odometer has reached the last recorded target',
      };
    }

    return {
      value: `${Math.abs(insights.nextDueOdometerDelta).toLocaleString('en-IN')} km overdue`,
      detail: 'Current odometer has passed the last recorded target',
    };
  }

  if (insights.nextDueDateDeltaDays !== null) {
    if (insights.nextDueDateDeltaDays > 0) {
      return {
        value: `In ${insights.nextDueDateDeltaDays} day${insights.nextDueDateDeltaDays === 1 ? '' : 's'}`,
        detail: 'Based on the latest logged next due date',
      };
    }

    if (insights.nextDueDateDeltaDays === 0) {
      return {
        value: 'Due today',
        detail: 'Based on the latest logged next due date',
      };
    }

    return {
      value: `${Math.abs(insights.nextDueDateDeltaDays)} day${Math.abs(insights.nextDueDateDeltaDays) === 1 ? '' : 's'} overdue`,
      detail: 'Based on the latest logged next due date',
    };
  }

  return {
    value: 'Not recorded',
    detail: 'Add next due date or odometer on maintenance entries to make this more useful.',
  };
}
