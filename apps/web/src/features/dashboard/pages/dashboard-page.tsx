import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

import { DashboardOverview } from '../components/dashboard-overview';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';

export function DashboardPage() {
  const dashboardSummaryQuery = useDashboardSummary();

  if (dashboardSummaryQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Get an immediate view of urgent reminders, recent service activity, and the current state of your garage."
          title="Dashboard"
        />
        <LoadingState
          description="Fetching the latest dashboard summary from the API."
          title="Loading dashboard summary"
        />
      </PageContainer>
    );
  }

  if (dashboardSummaryQuery.isError) {
    return (
      <PageContainer>
        <PageTitle
          actions={
            <Link className={buttonVariants()} to="/vehicles/new">
              Add Vehicle
            </Link>
          }
          description="Get an immediate view of urgent reminders, recent service activity, and the current state of your garage."
          title="Dashboard"
        />
        <ErrorState
          action={
            <Button onClick={() => dashboardSummaryQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="The dashboard summary could not be loaded. Check that the API is running and try again."
          title="Unable to load dashboard"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants()} to="/vehicles/new">
            Add Vehicle
          </Link>
        }
        description="Track urgent reminders, recent maintenance, receipts, and vehicle activity from one place."
        title="Dashboard"
      />

      <DashboardOverview summary={dashboardSummaryQuery.data} />
    </PageContainer>
  );
}
