import type { ReactNode } from 'react';

import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

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
          value={
            insights.averageSpend !== null ? (
              <Money value={insights.averageSpend} />
            ) : (
              'Not enough data'
            )
          }
        />
        <TrendMetric
          label="Average gap"
          value={
            insights.averageKmBetweenServices !== null
              ? format.distance(Math.round(insights.averageKmBetweenServices))
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
              ? format.distance(insights.kmSinceLastService)
              : 'No service logged yet'
          }
          detail={
            insights.latestService
              ? `Last service ${format.date(insights.latestService.serviceDate)}`
              : undefined
          }
        />
        <TrendMetric label="Next due" value={nextDueLabel.value} detail={nextDueLabel.detail} />
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
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-page/80 p-4">
      <Figure hint={detail} label={label} value={value} />
    </div>
  );
}

function getNextDueLabel(insights: VehicleServiceInsights) {
  if (insights.nextDueOdometerDelta !== null) {
    if (insights.nextDueOdometerDelta > 0) {
      return {
        value: `In ${format.distance(insights.nextDueOdometerDelta)}`,
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
      value: `${format.distance(Math.abs(insights.nextDueOdometerDelta))} overdue`,
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
    detail: 'Add next due date or odometer on service records to make this more useful.',
  };
}
