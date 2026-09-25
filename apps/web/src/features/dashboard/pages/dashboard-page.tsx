import { PageContainer } from '@/components/layout/page-container';
import { QuickLogMenuButton } from '@/components/layout/quick-log';
import { InstallAppCard } from '@/features/pwa/components/install-app-card';
import { ErrorState } from '@/components/shared/error-state';
import { PageTitle } from '@/components/shared/page-title';
import { StatusDot } from '@/components/shared/status-pill';
import { Button } from '@/components/ui/button';

import { AllClearPanel } from '../components/all-clear-panel';
import { AttentionFilters } from '../components/attention-filters';
import { AttentionQueue } from '../components/attention-queue';
import { ComingUpList } from '../components/coming-up-list';
import { CostsSummaryLine } from '../components/costs-summary-line';
import { DashboardOnboarding } from '../components/dashboard-onboarding';
import { DashboardSkeleton } from '../components/dashboard-skeleton';
import { HomeGarage } from '../components/home-garage';
import { RecentServiceCard } from '../components/recent-service-card';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import { isDashboardFocus, type DashboardSearch } from '../types/dashboard-search';
import { attentionCount } from '../utils/attention-set';
import { dashboardHeadline } from '../utils/dashboard-headline';
import { isNothingTracked, splitAttention } from '../utils/select-attention';

type DashboardPageProps = {
  searchState: DashboardSearch;
  onSearchStateChange: (next: Partial<DashboardSearch>) => void;
};

export function DashboardPage({ searchState, onSearchStateChange }: DashboardPageProps) {
  const dashboardSummaryQuery = useDashboardSummary();

  if (dashboardSummaryQuery.isPending) {
    return (
      <PageContainer className="pb-10">
        <PageTitle description="Checking what's due…" title="Home" />
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  if (dashboardSummaryQuery.isError) {
    return (
      <PageContainer className="pb-10">
        <PageTitle
          description="See urgent reminders, recent services, and garage activity at a glance."
          title="Home"
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
          title="Home"
        />
        <DashboardOnboarding />
      </PageContainer>
    );
  }

  const focus = isDashboardFocus(searchState.focus) ? searchState.focus : undefined;
  const { queue, comingUp } = splitAttention(summary.attention, focus);
  const showVehicle = summary.vehicles.length > 1;
  const urgent = attentionCount(summary.attentionCounts);
  const nothingTracked = isNothingTracked(summary, queue);
  // "All clear" would say more than it knows: the queue asks for papers or a reminder instead.
  const headline = nothingTracked
    ? { status: 'info' as const, text: 'Nothing tracked yet' }
    : dashboardHeadline(summary);
  // Logging is for the vehicles the user can change; a viewer is offered none of it.
  const canLog = summary.vehicles.some((vehicle) => vehicle.currentUserRole !== 'viewer');
  const allClear = !focus && urgent === 0 && !nothingTracked;

  return (
    <PageContainer className="pb-10">
      <PageTitle
        // From md up; below it the phone bar's ＋ is the same menu.
        actions={canLog ? <QuickLogMenuButton className="hidden md:inline-flex" /> : undefined}
        description={
          <StatusDot className="text-ui" status={headline.status}>
            {headline.text}
          </StatusDot>
        }
        title="Home"
      />

      {urgent > 0 || focus ? (
        <AttentionFilters counts={summary.attentionCounts} focus={focus} />
      ) : null}

      {/* Offered here, not on the empty onboarding dashboard: installing is worth
          it once there is a vehicle to come back to. */}
      <InstallAppCard />

      {allClear ? (
        <AllClearPanel next={comingUp[0]} showVehicle={showVehicle} />
      ) : (
        <AttentionQueue
          focus={focus}
          onSearchStateChange={onSearchStateChange}
          queue={queue}
          summary={summary}
        />
      )}

      {!focus ? <ComingUpList items={comingUp} showVehicle={showVehicle} /> : null}

      <HomeGarage vehicles={summary.vehicles} vehiclesTotal={summary.vehiclesTotal} />

      <RecentServiceCard
        recentMaintenance={summary.recentMaintenance}
        vehicles={summary.vehicles}
      />

      {summary.hasSpend ? <CostsSummaryLine loans={summary.loans} /> : null}
    </PageContainer>
  );
}
