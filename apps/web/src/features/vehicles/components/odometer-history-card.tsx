import { Activity } from 'lucide-react';

import { Money } from '@/components/shared/money';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

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
          Compare the current reading against logged service records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.history.length > 1 ? (
          <div className="space-y-3">
            {insights.history.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-page/70 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{entry.label}</p>
                    {entry.kind === 'current' ? (
                      <span className="rounded-full bg-fg px-2 py-0.5 text-caption font-medium text-surface">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{format.date(entry.date)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold text-fg">{format.odometer(entry.odometer)}</p>
                  {entry.totalCost !== undefined ? (
                    <p className="text-xs text-muted-foreground">
                      <Money value={entry.totalCost} />
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-page/70 px-4 py-6 text-sm text-muted-foreground">
            Log the first service visit with an odometer reading to start a useful odometer history.
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface px-4 py-3">
          <div className="rounded-lg border border-border/70 bg-page p-2">
            <Activity className="h-4 w-4 text-fg-2" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-fg">Why this matters</p>
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
