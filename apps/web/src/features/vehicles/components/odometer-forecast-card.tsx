import { Calendar, Gauge, TrendingUp, Info } from 'lucide-react';

import { Figure } from '@/components/shared/figure';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from '@/lib/format';
import { useVehicleInsights } from '../hooks/use-vehicle-insights';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OdometerForecastCardProps {
  vehicleId: string;
}

export function OdometerForecastCard({ vehicleId }: OdometerForecastCardProps) {
  const { data: insights, isLoading } = useVehicleInsights(vehicleId);

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full rounded-xl" />;
  }

  if (!insights) {
    return null;
  }

  const confidenceColors = {
    low: 'bg-soon-tint text-soon border-soon/20',
    medium: 'bg-brand-tint text-brand border-brand/20',
    high: 'bg-ok-tint text-ok border-ok/20',
  };

  const confidenceMessages = {
    low: 'Limited data. Predictions may be inaccurate.',
    medium: 'Satisfactory data points for basic forecasting.',
    high: 'Robust data. High accuracy predictions.',
  };

  const confidenceLabels = {
    low: 'Rough estimate',
    medium: 'Fair estimate',
    high: 'Solid estimate',
  };

  // Two dated readings are the least a rate can be measured from, and a rate of
  // zero (readings that never move forward) predicts nothing. Either way the
  // honest figure is the reading itself, not a prediction built on 0 km/day.
  const canPredict = insights.dataPointsCount >= 2 && insights.averageDailyMileage > 0;
  const lastRecordedDate = format.date(insights.lastRecordedDate);

  return (
    <Card className="overflow-hidden border-line/50 bg-surface shadow-xs transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-fg-3">Odometer estimate</CardTitle>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-fg">
              {format.odometer(
                canPredict ? insights.currentOdometerPredicted : insights.lastRecordedOdometer,
              )}
            </h3>
            {canPredict ? (
              <Badge variant="outline" className={confidenceColors[insights.confidence]}>
                {confidenceLabels[insights.confidence]}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-fg-3">
            {canPredict
              ? 'Predicted current odometer'
              : `Last recorded (${lastRecordedDate}). Log another reading to see a prediction.`}
          </p>
        </div>
        <div className="rounded-full bg-page p-2.5">
          <TrendingUp className="h-5 w-5 text-fg-2" />
        </div>
      </CardHeader>
      {canPredict ? (
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-fg-3">
                <Calendar className="h-3.5 w-3.5" />
                <span>Avg. daily</span>
              </div>
              <p className="text-sm font-semibold text-fg-2">
                {insights.averageDailyMileage} km/day
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-fg-3">
                <Gauge className="h-3.5 w-3.5" />
                <span>Avg. monthly</span>
              </div>
              <p className="text-sm font-semibold text-fg-2">
                {format.distance(insights.averageMonthlyMileage)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line-subtle pt-4">
            <Figure
              label="Last recorded"
              value={`${format.odometer(insights.lastRecordedOdometer)} (${lastRecordedDate})`}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help rounded-full p-1 transition-colors hover:bg-page">
                    <Info className="h-4 w-4 text-fg-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {confidenceMessages[insights.confidence]}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
