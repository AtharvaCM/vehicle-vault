import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AttachmentsSection } from '@/features/attachments/components/attachments-section';
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
      const record = await updateRecordMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: 'Maintenance record updated',
        description: 'Changes to this service entry were saved.',
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
        title: 'Unable to update maintenance record',
        description: getApiErrorMessage(error, 'Unable to update the maintenance record.'),
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
        description="Correct service details without losing the linked receipts or history."
        title="Edit Maintenance Record"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <MaintenanceForm
          initialValues={initialValues}
          isSubmitting={updateRecordMutation.isPending}
          onDirtyChange={setIsDirty}
          onSubmit={handleUpdateRecord}
          submitError={
            updateRecordMutation.error
              ? getApiErrorMessage(
                  updateRecordMutation.error,
                  'Unable to update the maintenance record.',
                )
              : null
          }
          submitHint="Edits keep the same receipts linked to this service entry."
          submitLabel="Save Changes"
          submittingLabel="Saving changes..."
          successMessage="Maintenance record updated."
          vehicleId={recordQuery.data?.vehicleId}
        />

        <div className="space-y-6">
          {recordQuery.data?.status === 'draft' || recordQuery.data?.source === 'ocr' ? (
            <MaintenanceDraftReviewCard recordId={recordId} />
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
                  Update the date, odometer, and cost whenever the original entry needs correction.
                </p>
                <p>Receipts and documents stay attached to the same service entry after edits.</p>
                <p>Use next due fields to keep follow-up service planning clear and accurate.</p>
              </CardContent>
            </Card>
          )}

          <AttachmentsSection recordId={recordId} />
        </div>
      </div>
    </PageContainer>
  );
}
