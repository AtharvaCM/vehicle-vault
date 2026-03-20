import { Link } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { buttonVariants } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';
import { useDashboardSummary } from '@/features/dashboard/hooks/use-dashboard-summary';
import { formatMaintenanceCategory } from '@/features/maintenance/utils/format-maintenance-category';

export function MaintenanceOverviewPage() {
  const dashboardSummaryQuery = useDashboardSummary();

  if (dashboardSummaryQuery.isPending) {
    return (
      <PageContainer>
        <PageHeader
          description="Review the latest logged service work across your garage."
          title="Maintenance"
        />
        <LoadingState
          description="Fetching recent service history from the backend."
          title="Loading maintenance history"
        />
      </PageContainer>
    );
  }

  if (dashboardSummaryQuery.isError) {
    return (
      <PageContainer>
        <PageHeader
          description="Review the latest logged service work across your garage."
          title="Maintenance"
        />
        <ErrorState
          description="Maintenance history could not be loaded right now. Try again after the API is reachable."
          title="Unable to load maintenance"
        />
      </PageContainer>
    );
  }

  const records = dashboardSummaryQuery.data.recentMaintenance;

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Link className={buttonVariants({ variant: 'outline' })} to="/vehicles">
            Choose a vehicle
          </Link>
        }
        description="This summary keeps maintenance visible at the product level while detailed logging stays anchored to each vehicle."
        title="Maintenance"
      />

      <SectionCard
        description="Recent service records from across your tracked vehicles."
        title="Latest maintenance activity"
      >
        {records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
              <Link
                key={record.id}
                className="block rounded-2xl border border-border/70 p-4 transition-colors hover:bg-accent/60"
                params={{ recordId: record.id }}
                to="/maintenance-records/$recordId"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {formatMaintenanceCategory(record.category)}
                    </p>
                    <p className="text-sm text-muted-foreground">{record.vehicleLabel}</p>
                  </div>
                  <div className="space-y-1 text-right text-sm text-muted-foreground">
                    <p>{formatDate(record.serviceDate)}</p>
                    <p>{formatCurrency(record.totalCost)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              <Link className={buttonVariants()} to="/vehicles">
                Log maintenance from a vehicle
              </Link>
            }
            description="Maintenance records will appear here as soon as you log your first service event."
            icon={ClipboardList}
            title="No maintenance records yet"
          />
        )}
      </SectionCard>
    </PageContainer>
  );
}
