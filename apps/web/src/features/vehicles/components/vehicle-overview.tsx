import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { TcoResponse, Vehicle } from '@vehicle-vault/shared';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { ShareBar, type Share } from '@/components/shared/chart/share-bar';
import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { SectionHeader } from '@/components/shared/section-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { tcoQueryOptions } from '@/features/analytics/api/get-tco';
import { TcoBody } from '@/features/analytics/components/tco-card';
import { costPerKmHint } from '@/features/analytics/utils/cost-per-km-hint';
import { SPEND_SLOT } from '@/features/analytics/utils/spend-series';
import { AttentionQueue } from '@/features/dashboard/components/attention-queue';
import {
  DataRow,
  LastServiceRow,
  NextDueRow,
  OdometerRow,
  PapersRow,
} from '@/features/dashboard/components/vehicle-health-rows';
import { useDashboardSummary } from '@/features/dashboard/hooks/use-dashboard-summary';
import type {
  DashboardAttentionItem,
  DashboardUrgency,
  DashboardVehicleHealth,
} from '@/features/dashboard/types/dashboard';
import { HistoryRow } from '@/features/history/components/history-row';
import { useHistory } from '@/features/history/hooks/use-history';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useVehicleInsights } from '../hooks/use-vehicle-insights';

/** How many due items the Overview shows before "All reminders". */
const ATTENTION_LIMIT = 3;
/** How many entries Recent activity shows before "View all". */
const RECENT_LIMIT = 5;

const URGENCY_RANK: Record<DashboardUrgency, number> = {
  overdue: 0,
  today: 1,
  this_week: 2,
  this_month: 3,
};

type VehicleOverviewProps = {
  vehicle: Vehicle;
  canEdit: boolean;
};

/**
 * The vehicle's Overview answers "is it OK, and what's next": what needs
 * attention, how the vehicle stands, what it costs to run and what happened
 * lately. Until anything has been logged, a setup checklist takes the place
 * of the cost and activity sections.
 */
export function VehicleOverview({ vehicle, canEdit }: VehicleOverviewProps) {
  const summaryQuery = useDashboardSummary();
  const historyQuery = useHistory({ vehicleId: vehicle.id });
  const tcoQuery = useQuery(tcoQueryOptions(vehicle.id));

  const summary = summaryQuery.data;
  const health = summary?.vehicles.find((entry) => entry.id === vehicle.id) ?? null;
  const queue = useMemo<DashboardAttentionItem[]>(
    () =>
      (summary?.attention ?? [])
        .filter((item) => item.vehicleId === vehicle.id)
        .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]),
    [summary?.attention, vehicle.id],
  );
  const recent = historyQuery.data?.pages[0]?.entries.slice(0, RECENT_LIMIT) ?? [];
  const hasSpend = tcoQuery.data ? Number(tcoQuery.data.totals.netSpend) > 0 : false;
  const isSparse = historyQuery.isSuccess && tcoQuery.isSuccess && recent.length === 0 && !hasSpend;

  return (
    <div className="space-y-6">
      {summary ? (
        <AttentionQueue
          onSearchStateChange={() => undefined}
          queue={queue}
          scope={{ vehicleId: vehicle.id, limit: ATTENTION_LIMIT }}
          summary={summary}
        />
      ) : (
        <Skeleton className="h-32 w-full rounded-xl" />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ThisVehicleCard
          canEdit={canEdit}
          health={health}
          // Needs attention already names the next item; the row would only repeat it.
          showNextDue={queue.length === 0}
          vehicle={vehicle}
        />
        {isSparse ? (
          <SetupChecklist canEdit={canEdit} health={health} vehicle={vehicle} />
        ) : tcoQuery.data && hasSpend ? (
          <RunningCostCard tco={tcoQuery.data} vehicleId={vehicle.id} />
        ) : null}
      </div>

      {!isSparse && recent.length > 0 ? (
        <Card className="overflow-hidden p-0" data-testid="recent-activity">
          <CardHeader className="border-b border-line-subtle px-5 pb-4 pt-5">
            <SectionHeader
              actions={
                <Link
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'history' }}
                  to="/vehicles/$vehicleId"
                >
                  View all
                </Link>
              }
              title="Recent activity"
            />
          </CardHeader>
          <CardContent className="p-0">
            {/* A HistoryRow is a list item: it needs its list (#357). */}
            <ul className="divide-y divide-line-subtle">
              {recent.map((entry) => (
                <HistoryRow
                  entry={entry}
                  key={`${entry.kind}:${entry.id}`}
                  showVehicle={false}
                  vehicle={vehicle}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type ThisVehicleCardProps = {
  vehicle: Vehicle;
  health: DashboardVehicleHealth | null;
  canEdit: boolean;
};

/** The reading and its pace, what is due next, the papers, the last service and the data. */
function ThisVehicleCard({
  vehicle,
  health,
  canEdit,
  showNextDue,
}: ThisVehicleCardProps & { showNextDue: boolean }) {
  const insights = useVehicleInsights(vehicle.id).data;
  // Two dated readings are the least a pace can be measured from (see the forecast rule).
  const pace =
    insights && insights.dataPointsCount >= 2 && insights.averageDailyMileage > 0
      ? `~${format.distance(insights.averageMonthlyMileage)} a month`
      : null;

  return (
    <Card data-testid="this-vehicle">
      <CardHeader className="pb-3">
        <SectionHeader title="This vehicle" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Figure
            hint={pace ?? 'Log another reading to see how far it goes a month.'}
            label="Odometer"
            value={format.odometer(vehicle.odometer)}
          />
          {health ? <OdometerRow bare canEdit={canEdit} vehicle={health} /> : null}
        </div>
        {health ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {showNextDue ? <NextDueRow vehicle={health} /> : null}
            <PapersRow vehicle={health} />
            <LastServiceRow vehicle={health} />
            <DataRow canEdit={canEdit} vehicle={health} />
          </div>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </CardContent>
    </Card>
  );
}

/** ₹/km and ₹/month up front, where the money went, and the full breakdown on demand. */
function RunningCostCard({ tco, vehicleId }: { tco: TcoResponse; vehicleId: string }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hasRate = Boolean(tco.derived.costPerKm || tco.derived.costPerMonth);
  const shares: Share[] = [
    {
      key: 'maintenance',
      label: 'Service',
      slot: SPEND_SLOT.maintenance,
      value: Number(tco.totals.maintenance),
    },
    { key: 'fuel', label: 'Fuel', slot: SPEND_SLOT.fuel, value: Number(tco.totals.fuel) },
    {
      key: 'insurance',
      label: 'Insurance',
      slot: SPEND_SLOT.insurance,
      value: Number(tco.totals.insurance),
    },
    {
      key: 'accessories',
      label: 'Accessories',
      slot: SPEND_SLOT.accessories,
      value: Number(tco.totals.accessories),
    },
    {
      key: 'loanInterest',
      label: 'Loan interest',
      slot: SPEND_SLOT.loanInterest,
      value: Number(tco.totals.loanInterest),
    },
  ];

  return (
    <Card data-testid="running-cost">
      <CardHeader className="pb-3">
        <SectionHeader
          actions={
            <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/costs">
              Costs
            </Link>
          }
          title="Running cost"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {hasRate ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Figure
                hint={costPerKmHint(tco)}
                label="₹ / km"
                value={
                  <Money
                    decimals={1}
                    value={tco.derived.costPerKm ? Number(tco.derived.costPerKm) : null}
                  />
                }
              />
              <Figure
                hint={
                  tco.ownershipMonths != null
                    ? `${tco.ownershipMonths} months owned`
                    : 'No purchase date'
                }
                label="₹ / month"
                value={
                  <Money
                    value={tco.derived.costPerMonth ? Number(tco.derived.costPerMonth) : null}
                  />
                }
              />
            </div>
            <p className="text-small text-fg-2">
              <Money value={Number(tco.totals.netSpend)} /> spent since you added it
            </p>
          </>
        ) : (
          // Neither rate can be worked out yet: the one honest figure is the total.
          <Figure
            hint={costPerKmHint(tco)}
            label="Spent since you added it"
            value={<Money value={Number(tco.totals.netSpend)} />}
          />
        )}
        <ShareBar label="Spend on this vehicle by category" shares={shares} />
        <Button
          aria-expanded={showBreakdown}
          aria-controls={`tco-breakdown-${vehicleId}`}
          onClick={() => setShowBreakdown((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {showBreakdown ? 'Hide the full breakdown' : 'Full breakdown'}
        </Button>
        {showBreakdown ? (
          <div id={`tco-breakdown-${vehicleId}`}>
            <TcoBody data={tco} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ChecklistKey = 'service' | 'papers' | 'fuel' | 'purchase';

type ChecklistItem = { key: ChecklistKey; label: string; done: boolean };

const CHECKLIST_ROW =
  'flex min-h-12 items-center gap-3 px-5 py-2 text-body transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

/** Each checklist item's destination, written out so the router can type every one. */
function ChecklistLink({
  item,
  vehicleId,
  children,
}: {
  item: ChecklistItem;
  vehicleId: string;
  children: ReactNode;
}) {
  const className = cn(CHECKLIST_ROW, item.done && 'text-fg-3');

  switch (item.key) {
    case 'service':
      return (
        <Link
          className={className}
          params={{ vehicleId }}
          to="/vehicles/$vehicleId/maintenance/new"
        >
          {children}
        </Link>
      );
    case 'papers':
      return (
        <Link
          className={className}
          params={{ vehicleId }}
          search={{ tab: 'papers' }}
          to="/vehicles/$vehicleId"
        >
          {children}
        </Link>
      );
    case 'fuel':
      return (
        <Link
          className={className}
          params={{ vehicleId }}
          search={{ tab: 'history', view: 'fuel' }}
          to="/vehicles/$vehicleId"
        >
          {children}
        </Link>
      );
    case 'purchase':
      return (
        <Link className={className} params={{ vehicleId }} to="/vehicles/$vehicleId/edit">
          {children}
        </Link>
      );
  }
}

/** For a vehicle with nothing logged yet: the few things that make every other screen useful. */
function SetupChecklist({ vehicle, health, canEdit }: ThisVehicleCardProps) {
  if (!canEdit) {
    return (
      <Card data-testid="setup-checklist">
        <CardContent className="py-6 text-small text-fg-3">
          Nothing has been logged for this vehicle yet.
        </CardContent>
      </Card>
    );
  }

  const insurance = health?.documents.insurance?.state;
  const items: ChecklistItem[] = [
    { key: 'service', label: 'Log the last service', done: Boolean(health?.lastService) },
    {
      key: 'papers',
      label: 'Add insurance and PUC dates',
      done: insurance !== undefined && insurance !== 'missing',
    },
    { key: 'fuel', label: 'Log a fuel fill', done: false },
    {
      key: 'purchase',
      label: 'Add the purchase date and price',
      done: vehicle.purchasePrice != null,
    },
  ];

  return (
    <Card data-testid="setup-checklist">
      <CardHeader className="pb-3">
        <SectionHeader
          description="A few details and every screen starts to help."
          title="Set up this vehicle"
        />
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-line-subtle">
          {items.map((item) => (
            <li key={item.key}>
              <ChecklistLink item={item} vehicleId={vehicle.id}>
                {item.done ? (
                  <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-ok" />
                ) : (
                  <Circle aria-hidden="true" className="size-5 shrink-0 text-fg-3" />
                )}
                <span className="min-w-0 flex-1">
                  {item.label}
                  {item.done ? <span className="sr-only"> (done)</span> : null}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
              </ChecklistLink>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
