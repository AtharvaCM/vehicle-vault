import { Link, useNavigate } from '@tanstack/react-router';
import { MaintenanceRecordStatus } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AttachmentsSection } from '@/features/attachments/components/attachments-section';
import { MaintenanceClaimLinkCard } from '@/features/claims/components/maintenance-claim-link-card';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import { MaintenanceDraftReviewCard } from '../components/maintenance-draft-review-card';
import { MaintenanceForm } from '../components/maintenance-form';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
import type { MaintenanceFormValues } from '../schemas/maintenance-form.schema';
import { useUpdateMaintenanceRecord } from '../hooks/use-update-maintenance-record';

type MaintenanceRecordEditPageProps = {
  recordId: string;
};

export function MaintenanceRecordEditPage({ recordId }: MaintenanceRecordEditPageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const recordQuery = useMaintenanceRecord(recordId);
  const updateRecordMutation = useUpdateMaintenanceRecord(recordId);
  // The record names its vehicle, and the vehicle carries the caller's role on
  // it; until the record has loaded there is no vehicle to ask about.
  const vehicleQuery = useVehicle(recordQuery.data?.vehicleId ?? '');
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  // A draft is an extraction nobody has agreed to yet: it stays out of every
  // cost, report and reminder until it is confirmed, and this page, where each
  // draft's "Review and confirm" leads, is where a human agrees to it. So saving
  // it here is the confirmation rather than another way to leave it uncounted.
  const isDraft = recordQuery.data?.status === MaintenanceRecordStatus.Draft;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved maintenance edits. Leave without saving?',
  });
  const initialValues = useMemo<Partial<MaintenanceFormValues> | undefined>(
    () =>
      recordQuery.data
        ? {
            entryMode:
              recordQuery.data.lineItems?.length || recordQuery.data.invoiceNumber
                ? 'detailed'
                : 'quick',
            serviceDate: toDateInputValue(recordQuery.data.serviceDate),
            odometer: recordQuery.data.odometer,
            category: recordQuery.data.category,
            workshopName: recordQuery.data.workshopName ?? '',
            invoiceNumber: recordQuery.data.invoiceNumber ?? '',
            currencyCode: recordQuery.data.currencyCode ?? 'INR',
            totalCost: recordQuery.data.totalCost,
            notes: recordQuery.data.notes ?? '',
            nextDueDate: toDateInputValue(recordQuery.data.nextDueDate),
            nextDueOdometer: recordQuery.data.nextDueOdometer,
            lineItems:
              recordQuery.data.lineItems?.map((lineItem) => ({
                kind: lineItem.kind,
                name: lineItem.name,
                normalizedCategory: lineItem.normalizedCategory,
                quantity: lineItem.quantity,
                unit: lineItem.unit ?? '',
                unitPrice: lineItem.unitPrice,
                lineTotal: lineItem.lineTotal,
                brand: lineItem.brand ?? '',
                partNumber: lineItem.partNumber ?? '',
                notes: lineItem.notes ?? '',
              })) ?? [],
          }
        : undefined,
    [recordQuery.data],
  );

  async function handleUpdateRecord(
    values: Parameters<typeof updateRecordMutation.mutateAsync>[0],
  ) {
    try {
      const record = await updateRecordMutation.mutateAsync(
        isDraft ? { ...values, status: MaintenanceRecordStatus.Confirmed } : values,
      );
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: isDraft ? 'Maintenance record confirmed' : 'Maintenance record updated',
        description: isDraft
          ? 'This service now counts towards costs, reports and its next service.'
          : 'Changes to this service entry were saved.',
      });

      try {
        await navigate({
          to: '/maintenance-records/$recordId',
          params: {
            recordId: record.id,
          },
        });
      } catch (error) {
        restoreNavigationGuard();
        throw error;
      }
    } catch (error) {
      appToast.error({
        title: isDraft
          ? 'Unable to confirm maintenance record'
          : 'Unable to update maintenance record',
        description: getApiErrorMessage(
          error,
          isDraft
            ? 'Unable to confirm the maintenance record.'
            : 'Unable to update the maintenance record.',
        ),
      });
      throw error;
    }
  }

  if (recordQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading this service entry before you edit it."
          title="Edit Maintenance Record"
        />
        <LoadingState
          description="Getting the latest maintenance details."
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
          description="You can only edit a maintenance record that still exists."
          title={isNotFound ? 'Maintenance record not found' : 'Unable to load maintenance record'}
        />
        <ErrorState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/maintenance">
              Back to Maintenance
            </Link>
          }
          description={
            isNotFound
              ? 'The requested maintenance record could not be found, so it cannot be edited.'
              : "We couldn't load this maintenance record. Try again in a moment."
          }
          title={isNotFound ? 'Maintenance record not found' : 'Unable to load maintenance record'}
        />
      </PageContainer>
    );
  }

  if (!canEdit) {
    return (
      <PageContainer>
        <PageTitle
          actions={
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ recordId }}
              to="/maintenance-records/$recordId"
            >
              Back to Record
            </Link>
          }
          description="This vehicle is shared with you for reading."
          title="Edit Maintenance Record"
        />
        <ViewOnlyNotice description="You can read this service entry and open its receipts, but not change them." />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer>
        <PageTitle
          actions={
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ recordId }}
              to="/maintenance-records/$recordId"
            >
              Back to Record
            </Link>
          }
          description={
            isDraft
              ? 'This draft does not count anywhere yet. Check the details, then confirm it.'
              : 'Correct service details without losing the linked receipts or history.'
          }
          title={isDraft ? 'Confirm Maintenance Record' : 'Edit Maintenance Record'}
        />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <MaintenanceForm
            currentOdometer={vehicleQuery.data?.odometer}
            initialValues={initialValues}
            isSubmitting={updateRecordMutation.isPending}
            onDirtyChange={setIsDirty}
            onSubmit={handleUpdateRecord}
            submitError={
              updateRecordMutation.error
                ? getApiErrorMessage(
                    updateRecordMutation.error,
                    isDraft
                      ? 'Unable to confirm the maintenance record.'
                      : 'Unable to update the maintenance record.',
                  )
                : null
            }
            submitHint={
              isDraft
                ? 'Confirming logs this service: it starts counting in costs and reports, and any next-due the workshop wrote down becomes a reminder.'
                : 'Edits keep the same receipts linked to this service entry.'
            }
            submitLabel={isDraft ? 'Confirm Record' : 'Save Changes'}
            submittingLabel={isDraft ? 'Confirming record...' : 'Saving changes...'}
            successMessage={
              isDraft ? 'Maintenance record confirmed.' : 'Maintenance record updated.'
            }
            recordId={recordId}
            vehicleId={recordQuery.data?.vehicleId}
          />

          <div className="space-y-6">
            {isDraft || recordQuery.data?.source === 'ocr' ? (
              <MaintenanceDraftReviewCard isDraft={isDraft} recordId={recordId} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Keep the record clear</CardTitle>
                  <CardDescription>
                    Small corrections now make the history easier to trust later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                  <p>
                    Update the date, odometer, and cost whenever the original entry needs
                    correction.
                  </p>
                  <p>Receipts and documents stay attached to the same service entry after edits.</p>
                  <p>Use next due fields to keep follow-up service planning clear and accurate.</p>
                </CardContent>
              </Card>
            )}

            {recordQuery.data?.vehicleId ? (
              <MaintenanceClaimLinkCard
                vehicleId={recordQuery.data.vehicleId}
                maintenanceRecordId={recordId}
              />
            ) : null}

            <AttachmentsSection recordId={recordId} />
          </div>
        </div>
      </PageContainer>
    </VehicleAccessProvider>
  );
}
