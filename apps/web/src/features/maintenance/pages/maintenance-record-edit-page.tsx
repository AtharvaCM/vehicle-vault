import { Link, useNavigate } from '@tanstack/react-router';
import { MaintenanceRecordStatus } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { AttachmentsSection } from '@/features/attachments/components/attachments-section';
import { useAttachmentExtractionStatus } from '@/features/attachments/hooks/use-attachment-extraction-status';
import { useAttachments } from '@/features/attachments/hooks/use-attachments';
import { MaintenanceClaimLinkCard } from '@/features/claims/components/maintenance-claim-link-card';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import { DraftBillSummary } from '../components/draft-bill-summary';
import { MaintenanceDraftReviewCard } from '../components/maintenance-draft-review-card';
import { MaintenanceForm } from '../components/maintenance-form';
import { useLinkedReminder } from '../hooks/use-linked-reminder';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
import type { MaintenanceFormValues } from '../schemas/maintenance-form.schema';
import { useUpdateMaintenanceRecord } from '../hooks/use-update-maintenance-record';
import { getFieldsFromBill, pickBillExtraction } from '../utils/get-fields-from-bill';

type MaintenanceRecordEditPageProps = {
  recordId: string;
  /** `?reminderId=`: the reminder a bill snapped from its "Log the service now" answers. */
  reminderId?: string;
};

export function MaintenanceRecordEditPage({
  recordId,
  reminderId,
}: MaintenanceRecordEditPageProps) {
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
  // Only a draft being confirmed answers a reminder; an edit of a logged
  // service never completes one.
  const { reminder: linkedReminder, repeat: reminderRepeat } = useLinkedReminder(
    isDraft ? reminderId : undefined,
    recordQuery.data?.vehicleId,
  );
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved service edits. Leave without saving?',
  });
  const initialValues = useMemo<Partial<MaintenanceFormValues> | undefined>(
    () =>
      recordQuery.data
        ? {
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

  // Upload-first fills a draft from its bill before opening it here. The fields
  // that still hold what the bill says carry a "from bill" marker, worked out
  // from the saved values so a reload keeps them.
  const attachmentsQuery = useAttachments(recordId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const draftAttachments = isDraft ? (attachmentsQuery.data ?? []) : [];
  const billExtraction = pickBillExtraction(draftAttachments);
  const fieldsFromBill = useMemo(
    () =>
      billExtraction && initialValues
        ? getFieldsFromBill(billExtraction, initialValues)
        : undefined,
    [billExtraction, initialValues],
  );

  async function handleUpdateRecord(
    values: Parameters<typeof updateRecordMutation.mutateAsync>[0],
  ) {
    try {
      const record = await updateRecordMutation.mutateAsync(
        isDraft
          ? {
              ...values,
              status: MaintenanceRecordStatus.Confirmed,
              ...(linkedReminder ? { reminderId: linkedReminder.id } : {}),
            }
          : values,
      );
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: isDraft ? 'Service record confirmed' : 'Service record updated',
        description: isDraft
          ? 'This service now counts towards costs, reports and its next service.'
          : 'Changes to this service record were saved.',
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
        title: isDraft ? 'Unable to confirm service record' : 'Unable to update service record',
        description: getApiErrorMessage(
          error,
          isDraft
            ? 'Unable to confirm the service record.'
            : 'Unable to update the service record.',
        ),
      });
      throw error;
    }
  }

  if (recordQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading this service record before you edit it."
          title="Edit service record"
        />
        <LoadingState
          description="Getting the latest service details."
          title="Loading service record"
        />
      </PageContainer>
    );
  }

  if (recordQuery.isError) {
    const isNotFound = recordQuery.error instanceof ApiError && recordQuery.error.status === 404;

    return (
      <PageContainer>
        <PageTitle
          description="You can only edit a service record that still exists."
          title={isNotFound ? 'Service record not found' : 'Unable to load service record'}
        />
        <ErrorState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/history">
              Back to History
            </Link>
          }
          description={
            isNotFound
              ? 'The requested service record could not be found, so it cannot be edited.'
              : "We couldn't load this service record. Try again in a moment."
          }
          title={isNotFound ? 'Service record not found' : 'Unable to load service record'}
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
              Back to record
            </Link>
          }
          description="This vehicle is shared with you for reading."
          title="Edit service record"
        />
        <ViewOnlyNotice description="You can read this service record and open its receipts, but not change them." />
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
              Back to record
            </Link>
          }
          description={
            isDraft
              ? linkedReminder
                ? `This draft does not count anywhere yet. Check the details, then confirm it to complete your reminder “${linkedReminder.title.trim()}”.`
                : 'This draft does not count anywhere yet. Check the details, then confirm it.'
              : 'Correct service details without losing the linked receipts or history.'
          }
          title={isDraft ? 'Confirm service record' : 'Edit service record'}
        />

        {isDraft ? (
          <DraftBillSummary
            attachments={draftAttachments}
            extraction={billExtraction}
            extractionAvailable={extractionStatusQuery.data?.available}
            fieldsFromBillCount={fieldsFromBill?.size ?? 0}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-card border border-line bg-surface p-6 max-md:-mx-4 max-md:rounded-none max-md:border-x-0 max-md:px-4 max-md:pt-4 max-md:pb-0">
            <MaintenanceForm
              currentOdometer={vehicleQuery.data?.odometer}
              fieldsFromBill={fieldsFromBill}
              initialValues={initialValues}
              isSubmitting={updateRecordMutation.isPending}
              onDirtyChange={setIsDirty}
              onSubmit={handleUpdateRecord}
              submitError={
                updateRecordMutation.error
                  ? getApiErrorMessage(
                      updateRecordMutation.error,
                      isDraft
                        ? 'Unable to confirm the service record.'
                        : 'Unable to update the service record.',
                    )
                  : null
              }
              submitHint={
                isDraft
                  ? 'Confirming logs this service: it starts counting in costs and reports, and its next due becomes a reminder.'
                  : 'Edits keep the same receipts linked to this service record.'
              }
              submitLabel={isDraft ? 'Confirm record' : 'Save changes'}
              submittingLabel={isDraft ? 'Confirming record...' : 'Saving changes...'}
              successMessage={isDraft ? 'Service record confirmed.' : 'Service record updated.'}
              recordId={recordId}
              reminderRepeat={reminderRepeat}
              scheduleNextDue={isDraft}
              vehicleId={recordQuery.data?.vehicleId}
            />
          </div>

          <div className="space-y-6">
            {isDraft || recordQuery.data?.source === 'ocr' ? (
              <MaintenanceDraftReviewCard isDraft={isDraft} recordId={recordId} />
            ) : null}

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
