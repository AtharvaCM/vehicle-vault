import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { ResourceLoadError } from '@/components/errors/resource-load-error';
import { buttonVariants } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { AttachmentsSection } from '@/features/attachments/components/attachments-section';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { MaintenanceDraftBadge } from '../components/maintenance-draft-badge';
import { MaintenanceSummaryCard } from '../components/maintenance-summary-card';
import { useDeleteMaintenanceRecord } from '../hooks/use-delete-maintenance-record';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';
import { isDraftRecord } from '../utils/is-draft-record';

type MaintenanceRecordDetailPageProps = {
  recordId: string;
};

export function MaintenanceRecordDetailPage({ recordId }: MaintenanceRecordDetailPageProps) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const recordQuery = useMaintenanceRecord(recordId);
  const deleteRecordMutation = useDeleteMaintenanceRecord();
  // The record names its vehicle, and the vehicle carries the caller's role on
  // it; until the record has loaded there is no vehicle to ask about.
  const vehicleQuery = useVehicle(recordQuery.data?.vehicleId ?? '');
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);

  async function handleDeleteRecord(vehicleId: string) {
    try {
      setActionError(null);
      await deleteRecordMutation.mutateAsync(recordId);
      appToast.success({
        title: 'Maintenance record deleted',
        description: 'The service entry and its linked files were removed.',
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
        <PageTitle description="Loading this service entry." title="Maintenance Record" />
        <LoadingState
          description="Getting the latest service details."
          title="Loading maintenance record"
        />
      </PageContainer>
    );
  }

  if (recordQuery.isError) {
    return (
      <ResourceLoadError
        error={recordQuery.error}
        isRetrying={recordQuery.isRefetching}
        listAction={
          <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
            Your vehicles
          </Link>
        }
        onRetry={() => void recordQuery.refetch()}
        pageDescription="Review the full details for one logged service entry."
        resourceLabel="Maintenance record"
        subject="record"
      />
    );
  }

  const record = recordQuery.data;

  return (
    <VehicleAccessProvider role={currentUserRole}>
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
              {canEdit ? (
                <>
                  <Link
                    className={buttonVariants()}
                    params={{ recordId: record.id }}
                    to="/maintenance-records/$recordId/edit"
                  >
                    Edit Record
                  </Link>
                  <ConfirmActionDialog
                    confirmLabel="Delete record"
                    description="This removes the service entry and any linked receipts or documents. This can't be undone."
                    isPending={deleteRecordMutation.isPending}
                    onConfirm={() => handleDeleteRecord(record.vehicleId)}
                    title="Delete this maintenance record?"
                    triggerLabel="Delete Record"
                    triggerVariant="secondary"
                  />
                </>
              ) : null}
            </div>
          }
          description="Review what was done, when it happened, and what it cost."
          title={formatMaintenanceCategory(record.category)}
        />

        {actionError ? <InlineError message={actionError} /> : null}

        {isDraftRecord(record) ? (
          <section
            aria-labelledby="draft-record-heading"
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MaintenanceDraftBadge />
                <h2 className="font-semibold text-amber-950" id="draft-record-heading">
                  Nobody has confirmed this record yet
                </h2>
              </div>
              <p className="text-sm text-amber-900">
                {canEdit
                  ? 'It is not counted in costs, reports or reminders until it is. Check what was read, then confirm it.'
                  : 'It is not counted in costs, reports or reminders until an owner or editor of this vehicle confirms it.'}
              </p>
            </div>
            {canEdit ? (
              <Link
                className={buttonVariants({ className: 'shrink-0' })}
                params={{ recordId: record.id }}
                to="/maintenance-records/$recordId/edit"
              >
                Review and confirm
              </Link>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <MaintenanceSummaryCard record={record} />
          <AttachmentsSection recordId={record.id} recordToFill={record} />
        </div>
      </PageContainer>
    </VehicleAccessProvider>
  );
}
