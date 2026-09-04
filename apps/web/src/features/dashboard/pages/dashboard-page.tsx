import { BellRing, Wrench } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';

import { AttentionQueue } from '../components/attention-queue';
import { AttentionSummary } from '../components/attention-summary';
import { ComingUpList } from '../components/coming-up-list';
import { DashboardOnboarding } from '../components/dashboard-onboarding';
import { DashboardSkeleton } from '../components/dashboard-skeleton';
import { GarageGrid } from '../components/garage-grid';
import { LoansCard } from '../components/loans-card';
import { RecentServiceCard } from '../components/recent-service-card';
import { SmartSuggestionsCard } from '../components/smart-suggestions-card';
import { SpendSection } from '../components/spend-section';
import { VehiclePickerMenu } from '../components/vehicle-picker-menu';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import { isDashboardFocus, type DashboardSearch } from '../types/dashboard-search';
import { dashboardHeadline } from '../utils/dashboard-headline';
import { splitAttention } from '../utils/select-attention';

type DashboardPageProps = {
  searchState: DashboardSearch;
  onSearchStateChange: (next: Partial<DashboardSearch>) => void;
};

export function DashboardPage({ searchState, onSearchStateChange }: DashboardPageProps) {
  const dashboardSummaryQuery = useDashboardSummary();

  if (dashboardSummaryQuery.isPending) {
    return (
      <PageContainer className="pb-10">
        <PageTitle description="Checking what's due…" title="Dashboard" />
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  if (dashboardSummaryQuery.isError) {
    return (
      <PageContainer className="pb-10">
        <PageTitle
          description="See urgent reminders, recent services, and garage activity at a glance."
          title="Dashboard"
        />
        <ErrorState
          action={
            <Button onClick={() => dashboardSummaryQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load your dashboard. Try again in a moment."
          title="Unable to load dashboard"
        />
      </PageContainer>
    );
  }

  const summary = dashboardSummaryQuery.data;

  if (summary.totalVehicles === 0) {
    return (
      <PageContainer className="pb-10">
        <PageTitle
          description="Add your first vehicle and we'll keep track of what's due."
          title="Dashboard"
        />
        <DashboardOnboarding />
      </PageContainer>
    );
  }

  const focus = isDashboardFocus(searchState.focus) ? searchState.focus : undefined;
  const { queue, comingUp } = splitAttention(summary.attention, focus);
  const showVehicle = summary.vehicles.length > 1;

  return (
    <PageContainer className="pb-10">
      <PageTitle
        actions={
          summary.vehicles.length >= 1 ? (
            <>
              <VehiclePickerMenu
                buildLink={(vehicleId) => ({
                  to: '/vehicles/$vehicleId/maintenance/new',
                  params: { vehicleId },
                })}
                icon={Wrench}
                label="Log service"
                variant="default"
                vehicles={summary.vehicles}
              />
              <VehiclePickerMenu
                buildLink={(vehicleId) => ({
                  to: '/vehicles/$vehicleId/reminders/new',
                  params: { vehicleId },
                })}
                className="hidden sm:inline-flex"
                icon={BellRing}
                label="Add reminder"
                variant="outline"
                vehicles={summary.vehicles}
              />
            </>
          ) : undefined
        }
        description={dashboardHeadline(summary)}
        title="Dashboard"
      />

      <AttentionSummary focus={focus} summary={summary} />

      <AttentionQueue
        focus={focus}
        onSearchStateChange={onSearchStateChange}
        queue={queue}
        summary={summary}
      />

      {!focus ? <ComingUpList items={comingUp} showVehicle={showVehicle} /> : null}

      <GarageGrid vehicles={summary.vehicles} vehiclesTotal={summary.vehiclesTotal} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SmartSuggestionsCard insights={summary.insights} />
        <div className={summary.insights.length === 0 ? 'lg:col-span-2' : undefined}>
          <RecentServiceCard
            recentMaintenance={summary.recentMaintenance}
            vehicles={summary.vehicles}
          />
        </div>
      </div>

      <LoansCard loans={summary.loans} />

      {summary.hasSpend ? <SpendSection /> : null}
    </PageContainer>
  );
}
