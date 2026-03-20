import { Link, useNavigate } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import { MaintenanceForm } from '../components/maintenance-form';
import { useMaintenanceRecord } from '../hooks/use-maintenance-record';
import { useUpdateMaintenanceRecord } from '../hooks/use-update-maintenance-record';

type MaintenanceRecordEditPageProps = {
  recordId: string;
};

export function MaintenanceRecordEditPage({ recordId }: MaintenanceRecordEditPageProps) {
  const navigate = useNavigate();
  const recordQuery = useMaintenanceRecord(recordId);
  const updateRecordMutation = useUpdateMaintenanceRecord(recordId);

  async function handleUpdateRecord(
    values: Parameters<typeof updateRecordMutation.mutateAsync>[0],
  ) {
    const record = await updateRecordMutation.mutateAsync(values);

    await navigate({
      to: '/maintenance-records/$recordId',
      params: {
        recordId: record.id,
      },
    });
  }

  if (recordQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading the maintenance record before editing."
          title="Edit Maintenance Record"
        />
        <LoadingState
          description="Fetching the current maintenance values from the API."
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
          description="Maintenance edits require an existing maintenance record."
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
              : 'The maintenance record could not be loaded. Check the API and try again.'
          }
          title={isNotFound ? 'Maintenance record not found' : 'Unable to load maintenance record'}
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
            params={{ recordId }}
            to="/maintenance-records/$recordId"
          >
            Back to Record
          </Link>
        }
        description="Adjust recorded service details while keeping receipts and linked history intact."
        title="Edit Maintenance Record"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <MaintenanceForm
          initialValues={{
            serviceDate: toDateInputValue(record.serviceDate),
            odometer: record.odometer,
            category: record.category,
            workshopName: record.workshopName ?? '',
            totalCost: record.totalCost,
            notes: record.notes ?? '',
            nextDueDate: toDateInputValue(record.nextDueDate),
            nextDueOdometer: record.nextDueOdometer,
          }}
          isSubmitting={updateRecordMutation.isPending}
          onSubmit={handleUpdateRecord}
          submitError={
            updateRecordMutation.error
              ? getApiErrorMessage(
                  updateRecordMutation.error,
                  'Unable to update the maintenance record.',
                )
              : null
          }
          submitHint="Updating a record keeps its linked attachments and history intact."
          submitLabel="Save Changes"
          submittingLabel="Saving changes..."
          successMessage="Maintenance record updated successfully."
        />

        <Card>
          <CardHeader>
            <CardTitle>Edit guidance</CardTitle>
            <CardDescription>Keep maintenance records specific and traceable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Update service dates, odometer, and cost when the original entry needs correction.</p>
            <p>Receipt and attachment links stay attached to the maintenance record after edits.</p>
            <p>Use next-due fields to keep follow-up service planning clean and accurate.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
