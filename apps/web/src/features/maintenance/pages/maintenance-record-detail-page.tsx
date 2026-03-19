import { Link } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';

import { MaintenanceSummaryCard } from '../components/maintenance-summary-card';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

type MaintenanceRecordDetailPageProps = {
  recordId: string;
};

export function MaintenanceRecordDetailPage({ recordId }: MaintenanceRecordDetailPageProps) {
  const recordQuery = useMaintenanceRecord(recordId);

  if (recordQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading the latest maintenance record from the API."
          title="Maintenance Record"
        />
        <Card>
          <CardHeader>
            <CardTitle>Loading maintenance record</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while the maintenance record is fetched.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (recordQuery.isError) {
    const isNotFound = recordQuery.error instanceof ApiError && recordQuery.error.status === 404;

    return (
      <PageContainer>
        <PageTitle
          description="Maintenance detail pages are driven by backend state."
          title={isNotFound ? 'Maintenance record not found' : 'Unable to load maintenance record'}
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description={
            isNotFound
              ? 'The requested maintenance record does not exist or may have been removed.'
              : 'The maintenance record could not be loaded. Check that the API is running and try again.'
          }
          title={isNotFound ? 'Maintenance record not found' : 'Maintenance request failed'}
        />
      </PageContainer>
    );
  }

  const record = recordQuery.data;

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link
            className={buttonVariants({ variant: 'secondary' })}
            params={{ vehicleId: record.vehicleId }}
            to="/vehicles/$vehicleId/maintenance"
          >
            Back to Maintenance History
          </Link>
        }
        description="Review the details captured for this maintenance event."
        title={formatMaintenanceCategory(record.category)}
      />

      <MaintenanceSummaryCard record={record} />
    </PageContainer>
  );
}
