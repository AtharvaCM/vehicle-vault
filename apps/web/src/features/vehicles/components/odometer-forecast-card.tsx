import { Calendar, Gauge, TrendingUp, Info } from 'lucide-react';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
    low: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    high: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };

  const confidenceMessages = {
    low: 'Limited data. Predictions may be inaccurate.',
    medium: 'Satisfactory data points for basic forecasting.',
    high: 'Robust data. High accuracy predictions.',
  };

  return (
    <Card className="overflow-hidden border-zinc-200/50 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-800/50 dark:bg-zinc-900/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Intelligence
          </CardTitle>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {insights.currentOdometerPredicted.toLocaleString()} km
            </h3>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider ${confidenceColors[insights.confidence]}`}
            >
              {insights.confidence} confidence
            </Badge>
          </div>
          <p className="text-xs text-zinc-400">Predicted current odometer</p>
        </div>
        <div className="rounded-full bg-zinc-100 p-2.5 dark:bg-zinc-800">
          <TrendingUp className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Avg. Daily</span>
            </div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {insights.averageDailyMileage} km/day
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Gauge className="h-3.5 w-3.5" />
              <span>Avg. Monthly</span>
            </div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {insights.averageMonthlyMileage.toLocaleString()} km
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">
              Last Recorded
            </span>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {insights.lastRecordedOdometer.toLocaleString()} km (
              {format(new Date(insights.lastRecordedDate), 'MMM d, yyyy')})
            </span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help rounded-full p-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Info className="h-4 w-4 text-zinc-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                {confidenceMessages[insights.confidence]}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
