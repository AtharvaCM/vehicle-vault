import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/shared/stat-card';

type DashboardOverviewProps = {
  totalVehicles: number;
  upcomingReminders: number;
  overdueTasks: number;
};

export function DashboardOverview({
  overdueTasks,
  totalVehicles,
  upcomingReminders,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          description="Active vehicles ready to attach service history and documents."
          label="Vehicles"
          value={String(totalVehicles)}
        />
        <StatCard
          accent={<Badge tone="accent">Due Soon</Badge>}
          description="Reminders that should surface prominently in the next workflow pass."
          label="Upcoming reminders"
          value={String(upcomingReminders)}
        />
        <StatCard
          accent={<Badge tone="danger">Attention</Badge>}
          description="Items that need escalation once backend rules and notifications land."
          label="Overdue tasks"
          value={String(overdueTasks)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Implementation focus</CardTitle>
            <CardDescription>
              The dashboard is structured around query-backed summary cards plus domain-specific
              sections for reminders and maintenance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Use feature-local query options for summary data rather than fetching directly inside
              route files.
            </p>
            <p>
              Keep domain widgets isolated so reminders, maintenance, and attachment summaries can
              evolve independently.
            </p>
            <p>
              Prefer server-derived overview data here once the backend exposes aggregate endpoints.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next additions</CardTitle>
            <CardDescription>Suggested extensions after the MVP shell.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Connect reminder summaries to live query state.</p>
            <p>Add maintenance due badges per vehicle.</p>
            <p>Introduce recent-activity cards backed by paginated queries.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
