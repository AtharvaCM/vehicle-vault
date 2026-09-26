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
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { AttachmentsSection } from '@/features/attachments/components/attachments-section';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';

import { MaintenanceDraftBadge } from '../components/maintenance-draft-badge';
import { MaintenanceReceipt } from '../components/maintenance-receipt';
import { useDeleteMaintenanceRecord } from '../hooks/use-delete-maintenance-record';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
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
  const vehicleName = vehicleQuery.data
    ? `${getVehicleDisplayName(vehicleQuery.data)} · ${format.registration(vehicleQuery.data.registrationNumber)}`
    : undefined;
  const { canEdit } = accessFor(currentUserRole);

  async function handleDeleteRecord(vehicleId: string) {
    try {
      setActionError(null);
      await deleteRecordMutation.mutateAsync(recordId);
      appToast.success({
        title: 'Service record deleted',
        description: 'The service record and its linked files were removed.',
      });
      await navigate({
        to: '/vehicles/$vehicleId',
        params: { vehicleId },
        search: { tab: 'history' },
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to delete service record',
        description: getApiErrorMessage(error, 'Unable to delete the service record.'),
      });
      setActionError(getApiErrorMessage(error, 'Unable to delete the service record.'));
    }
  }

  if (recordQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description="Loading this service record." title="Service record" />
        <LoadingState
          description="Getting the latest service details."
          title="Loading service record"
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
          <Link className={buttonVariants({ variant: 'outline' })} to="/garage">
            Your garage
          </Link>
        }
        onRetry={() => void recordQuery.refetch()}
        resourceLabel="Service record"
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
            // The breadcrumb is the way back to the vehicle's History.
            <div className="flex flex-wrap gap-3">
              {canEdit ? (
                <>
                  <Link
                    className={buttonVariants()}
                    params={{ recordId: record.id }}
                    to="/maintenance-records/$recordId/edit"
                  >
                    Edit record
                  </Link>
                  <ConfirmActionDialog
                    confirmLabel="Delete record"
                    description="This removes the service record and any linked receipts or documents. This can't be undone."
                    isPending={deleteRecordMutation.isPending}
                    onConfirm={() => handleDeleteRecord(record.vehicleId)}
                    title="Delete this service record?"
                    triggerLabel="Delete record"
                    triggerVariant="ghost"
                  />
                </>
              ) : null}
            </div>
          }
          description={vehicleName ?? 'What was done, when, and what it cost.'}
          title={format.enumLabel('maintenanceCategory', record.category)}
        />

        {actionError ? <InlineError message={actionError} /> : null}

        {isDraftRecord(record) ? (
          <section
            aria-labelledby="draft-record-heading"
            className="flex flex-col gap-3 rounded-xl border border-soon/30 bg-soon-tint p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MaintenanceDraftBadge />
                <h2 className="font-semibold text-soon" id="draft-record-heading">
                  Nobody has confirmed this record yet
                </h2>
              </div>
              <p className="text-ui text-soon">
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

        {/* One column, as a receipt reads; from xl the bill and photos take a rail beside it. */}
        <div className="grid max-w-3xl gap-6 xl:max-w-none xl:grid-cols-[minmax(0,720px)_minmax(0,1fr)] xl:items-start">
          <MaintenanceReceipt record={record} />
          <AttachmentsSection recordId={record.id} recordToFill={record} />
        </div>
      </PageContainer>
    </VehicleAccessProvider>
  );
}
