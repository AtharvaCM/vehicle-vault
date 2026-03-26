import { Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { VehicleServiceInsights } from '../utils/get-vehicle-service-insights';

type OdometerHistoryCardProps = {
  insights: VehicleServiceInsights;
};

export function OdometerHistoryCard({ insights }: OdometerHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Odometer history</CardTitle>
        <CardDescription>
          Compare the current reading against logged service entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.history.length > 1 ? (
          <div className="space-y-3">
            {insights.history.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-slate-50/70 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-950">{entry.label}</p>
                    {entry.kind === 'current' ? (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold text-slate-950">
                    {entry.odometer.toLocaleString('en-IN')} km
                  </p>
                  {entry.totalCost !== undefined ? (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(entry.totalCost)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-slate-50/70 px-4 py-6 text-sm text-muted-foreground">
            Log the first maintenance visit with an odometer reading to start a useful mileage
            history.
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-white px-4 py-3">
          <div className="rounded-lg border border-border/70 bg-slate-50 p-2">
            <Activity className="h-4 w-4 text-slate-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-950">Why this matters</p>
            <p className="text-sm text-muted-foreground">
              Consistent odometer entries make kilometre-based reminders and service planning more
              reliable.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
