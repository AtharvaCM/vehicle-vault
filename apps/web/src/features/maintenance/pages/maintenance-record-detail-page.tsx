import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { AttachmentsSection } from '@/features/attachments/components/attachments-section';

import { MaintenanceSummaryCard } from '../components/maintenance-summary-card';
import { useDeleteMaintenanceRecord } from '../hooks/use-delete-maintenance-record';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

type MaintenanceRecordDetailPageProps = {
  recordId: string;
};

export function MaintenanceRecordDetailPage({ recordId }: MaintenanceRecordDetailPageProps) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const recordQuery = useMaintenanceRecord(recordId);
  const deleteRecordMutation = useDeleteMaintenanceRecord();

  async function handleDeleteRecord(vehicleId: string) {
    try {
      setActionError(null);
      await deleteRecordMutation.mutateAsync(recordId);
      appToast.success({
        title: 'Maintenance record deleted',
        description: 'The service record and its linked attachment metadata were removed.',
      });
      await navigate({
        to: '/vehicles/$vehicleId/maintenance',
        params: { vehicleId },
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to delete maintenance record',
        description: getApiErrorMessage(error, 'Unable to delete the maintenance record.'),
      });
      setActionError(getApiErrorMessage(error, 'Unable to delete the maintenance record.'));
    }
  }

  if (recordQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading the latest maintenance record from the API."
          title="Maintenance Record"
        />
        <LoadingState
          description="Fetching the latest maintenance record from the API."
          title="Loading maintenance record"
        />
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
        <ErrorState
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
          <div className="flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId: record.vehicleId }}
              to="/vehicles/$vehicleId/maintenance"
            >
              Back to Maintenance History
            </Link>
            <Link
              className={buttonVariants()}
              params={{ recordId: record.id }}
              to="/maintenance-records/$recordId/edit"
            >
              Edit Record
            </Link>
            <ConfirmActionDialog
              confirmLabel="Delete record"
              description="This removes the maintenance record and its linked attachment metadata. Local uploaded files are also removed when available."
              isPending={deleteRecordMutation.isPending}
              onConfirm={() => handleDeleteRecord(record.vehicleId)}
              title="Delete this maintenance record?"
              triggerLabel="Delete Record"
              triggerVariant="secondary"
            />
          </div>
        }
        description="Review the details captured for this maintenance event."
        title={formatMaintenanceCategory(record.category)}
      />

      {actionError ? <InlineError message={actionError} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <MaintenanceSummaryCard record={record} />
        <AttachmentsSection recordId={record.id} />
      </div>
    </PageContainer>
  );
}
