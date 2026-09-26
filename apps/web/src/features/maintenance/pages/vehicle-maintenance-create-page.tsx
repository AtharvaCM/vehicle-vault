import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { FuelType, type MaintenanceCategory } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { NumberPlate } from '@/components/shared/number-plate';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { vehicleRemindersQueryOptions } from '@/features/reminders/api/get-vehicle-reminders';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { BillCapture } from '../components/bill-capture';
import { MaintenanceForm } from '../components/maintenance-form';
import { useCreateMaintenanceRecord } from '../hooks/use-create-maintenance-record';
import { useUploadFirstDraft } from '../hooks/use-upload-first-draft';
import { useLinkedReminder } from '../hooks/use-linked-reminder';
import { pickDueCategory, pickFromReminder } from '../utils/pick-due-category';

type VehicleMaintenanceCreatePageProps = {
  vehicleId: string;
  /** `?category=`: the work to start on (see `MaintenanceCreateSearch`). */
  category?: MaintenanceCategory;
  /** `?reminderId=`: the reminder this service is logged for. */
  reminderId?: string;
};

export function VehicleMaintenanceCreatePage({
  vehicleId,
  category,
  reminderId,
}: VehicleMaintenanceCreatePageProps) {
  useDocumentTitle('Log service | Vehicle Vault');
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const vehicleQuery = useVehicle(vehicleId);
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const createMaintenanceMutation = useCreateMaintenanceRecord(vehicleId);
  // What the form starts on: the reminder it was opened from, else the
  // category the address names, else whatever service the vehicle's
  // reminders say is due, with the reason shown under the chips.
  const { reminder: linkedReminder, repeat: reminderRepeat } = useLinkedReminder(
    reminderId,
    vehicleId,
  );
  const uploadFirst = useUploadFirstDraft(vehicleId, linkedReminder?.id);
  const remindersQuery = useQuery({
    ...vehicleRemindersQueryOptions(vehicleId),
    enabled: !reminderId && !category,
  });
  const suggestedCategory = useMemo(() => {
    if (linkedReminder) return pickFromReminder(linkedReminder, category);
    if (category) return { category, reason: '' };
    return remindersQuery.data ? pickDueCategory(remindersQuery.data) : null;
  }, [category, linkedReminder, remindersQuery.data]);
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved service details. Leave without saving?',
  });

  async function handleCreateMaintenanceRecord(
    values: Parameters<typeof createMaintenanceMutation.mutateAsync>[0],
  ) {
    try {
      // Logged from a reminder: the API completes it with this record and
      // counts the next occurrence from it.
      const created = await createMaintenanceMutation.mutateAsync(
        linkedReminder ? { ...values, reminderId: linkedReminder.id } : values,
      );
      const restoreNavigationGuard = allowNextNavigation();
      toast.success('Service record created', {
        description: 'The service record was added to this vehicle.',
        action: {
          label: 'Link to claim',
          onClick: () => {
            navigate({
              to: '/maintenance-records/$recordId/edit',
              params: { recordId: created.id },
            }).catch(() => undefined);
          },
        },
      });

      try {
        // Onto the record just saved, to see it as it will be kept.
        await navigate({
          to: '/maintenance-records/$recordId',
          params: { recordId: created.id },
        });
      } catch (error) {
        restoreNavigationGuard();
        throw error;
      }
    } catch (error) {
      appToast.error({
        title: 'Unable to create service record',
        description: getApiErrorMessage(error, 'Unable to create the service record.'),
      });
      throw error;
    }
  }

  const submitError = createMaintenanceMutation.error
    ? getApiErrorMessage(createMaintenanceMutation.error, 'Unable to create the service record.')
    : null;

  if (
    vehicleQuery.isError &&
    vehicleQuery.error instanceof ApiError &&
    vehicleQuery.error.status === 404
  ) {
    return (
      <PageContainer>
        <PageTitle
          description="Service records can only be created for an existing vehicle."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/garage">
              Back to Garage
            </Link>
          }
          description="The requested vehicle could not be found, so a service record cannot be created for it."
          title="Vehicle not found"
        />
      </PageContainer>
    );
  }

  const vehicleTitle = vehicleQuery.data
    ? vehicleQuery.data.nickname?.trim() || `${vehicleQuery.data.make} ${vehicleQuery.data.model}`
    : 'Vehicle';

  if (!canEdit) {
    return (
      <PageContainer>
        <PageTitle
          description={`${vehicleTitle} is shared with you for reading.`}
          title="Log service"
        />
        <ViewOnlyNotice
          action={
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              search={{ tab: 'history' }}
              to="/vehicles/$vehicleId"
            >
              Back to History
            </Link>
          }
          description="You can read this vehicle's service history, but not log new entries for it."
        />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer className="max-w-2xl gap-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="font-display text-title font-semibold text-fg">Log service</h1>
          {vehicleQuery.data ? (
            <NumberPlate
              className="shrink-0"
              electric={vehicleQuery.data.fuelType === FuelType.Electric}
              emptyLabel={vehicleTitle}
              registration={vehicleQuery.data.registrationNumber}
              size="md"
            />
          ) : null}
        </header>

        <div className="rounded-card border border-line bg-surface p-6 max-md:-mx-4 max-md:rounded-none max-md:border-x-0 max-md:px-4 max-md:pt-4 max-md:pb-0">
          <MaintenanceForm
            cancel={
              <Link
                className={buttonVariants({ variant: 'ghost', size: 'lg' })}
                params={{ vehicleId }}
                search={{ tab: 'history' }}
                to="/vehicles/$vehicleId"
              >
                Cancel
              </Link>
            }
            currentOdometer={vehicleQuery.data?.odometer}
            isSubmitting={createMaintenanceMutation.isPending || uploadFirst.isPending}
            leading={
              <BillCapture
                canRead={uploadFirst.canRead}
                isPending={uploadFirst.isPending}
                onFiles={(event) => void uploadFirst.onFiles(event)}
              />
            }
            onDirtyChange={setIsDirty}
            onSubmit={handleCreateMaintenanceRecord}
            reminderRepeat={reminderRepeat}
            scheduleNextDue
            submitError={submitError}
            suggestedCategory={suggestedCategory}
            vehicleId={vehicleId}
          />
        </div>
      </PageContainer>
    </VehicleAccessProvider>
  );
}
