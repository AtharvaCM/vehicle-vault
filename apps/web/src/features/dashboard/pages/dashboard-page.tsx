import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';

import { DashboardOverview } from '../components/dashboard-overview';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';

export function DashboardPage() {
  const dashboardSummaryQuery = useDashboardSummary();

  if (dashboardSummaryQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="See urgent reminders, recent services, and garage activity at a glance."
          title="Dashboard"
        />
        <LoadingState
          description="Pulling together the latest activity from your garage."
          title="Loading dashboard summary"
        />
      </PageContainer>
    );
  }

  if (dashboardSummaryQuery.isError) {
    return (
      <PageContainer>
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

  return (
    <PageContainer>
      <PageTitle
        description="See urgent reminders, recent services, receipts, and vehicle activity at a glance."
        title="Dashboard"
      />

      <DashboardOverview summary={dashboardSummaryQuery.data} />
    </PageContainer>
  );
}
