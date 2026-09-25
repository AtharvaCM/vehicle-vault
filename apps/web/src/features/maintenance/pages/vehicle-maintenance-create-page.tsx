import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { FuelType, type MaintenanceCategory } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { NumberPlate } from '@/components/shared/number-plate';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { applyAttachmentExtraction } from '@/features/attachments/api/apply-attachment-extraction';
import { uploadAttachments } from '@/features/attachments/api/upload-attachments';
import { extractAttachment } from '@/features/attachments/api/extract-attachment';
import { extractAttachments } from '@/features/attachments/api/extract-attachments';
import { useAttachmentExtractionStatus } from '@/features/attachments/hooks/use-attachment-extraction-status';
import { reminderDetailQueryOptions } from '@/features/reminders/api/get-reminder-by-id';
import { vehicleRemindersQueryOptions } from '@/features/reminders/api/get-vehicle-reminders';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { queryKeys } from '@/lib/query/query-keys';
import { appToast } from '@/lib/toast';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { BillCapture } from '../components/bill-capture';
import { MaintenanceForm } from '../components/maintenance-form';
import { useCreateMaintenanceDraft } from '../hooks/use-create-maintenance-draft';
import { useCreateMaintenanceRecord } from '../hooks/use-create-maintenance-record';
import { hasBillValues } from '../utils/get-fields-from-bill';
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
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadFirstPending, setIsUploadFirstPending] = useState(false);
  const vehicleQuery = useVehicle(vehicleId);
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const createMaintenanceMutation = useCreateMaintenanceRecord(vehicleId);
  const createDraftMutation = useCreateMaintenanceDraft(vehicleId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  // What the form starts on: the reminder it was opened from, else the
  // category the address names, else whatever service the vehicle's
  // reminders say is due, with the reason shown under the chips.
  const reminderQuery = useQuery({
    ...reminderDetailQueryOptions(reminderId ?? ''),
    enabled: Boolean(reminderId),
  });
  const remindersQuery = useQuery({
    ...vehicleRemindersQueryOptions(vehicleId),
    enabled: !reminderId && !category,
  });
  const linkedReminder =
    reminderQuery.data && reminderQuery.data.vehicleId === vehicleId ? reminderQuery.data : null;
  const suggestedCategory = useMemo(() => {
    if (linkedReminder) return pickFromReminder(linkedReminder, category);
    if (category) return { category, reason: '' };
    return remindersQuery.data ? pickDueCategory(remindersQuery.data) : null;
  }, [category, linkedReminder, remindersQuery.data]);
  // A reminder that repeats sets the next one by its own rule (#295: "the next
  // one will be counted from the service you log"), not the schedule.
  const reminderRepeat = useMemo(
    () =>
      linkedReminder &&
      (linkedReminder.repeatEveryKm != null || linkedReminder.repeatEveryMonths != null)
        ? {
            km: linkedReminder.repeatEveryKm ?? null,
            months: linkedReminder.repeatEveryMonths ?? null,
          }
        : null,
    [linkedReminder],
  );
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
        await navigate({
          to: '/vehicles/$vehicleId',
          params: {
            vehicleId,
          },
          search: { tab: 'history' },
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

  async function handleUploadFirst(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      return;
    }

    let draftRecordId: string | null = null;
    setIsUploadFirstPending(true);

    try {
      const draftRecord = await createDraftMutation.mutateAsync();
      draftRecordId = draftRecord.id;
      const attachments = await uploadAttachments(draftRecord.id, files);
      const canExtract = extractionStatusQuery.data?.available !== false;

      // A failed read must not lose the draft or the uploads, but it must not pass
      // for a successful one either: the draft still opens, and its confirm page
      // says why the form is blank (see `DraftBillSummary`).
      let extractionError: unknown = null;
      let applyError: unknown = null;
      let isFilledFromBill = false;

      if (canExtract) {
        const attachmentIds = attachments.map((attachment) => attachment.id);
        const [primaryAttachmentId] = attachmentIds;

        try {
          const extraction =
            attachmentIds.length > 1
              ? await extractAttachments(draftRecord.id, attachmentIds)
              : primaryAttachmentId
                ? await extractAttachment(primaryAttachmentId)
                : undefined;

          // The record was made a draft a moment ago, and apply is only ever
          // accepted on a draft, so this never touches a confirmed record:
          // nothing counts until the owner confirms on the next page.
          if (primaryAttachmentId && extraction && hasBillValues(extraction)) {
            try {
              await applyAttachmentExtraction(primaryAttachmentId);
              isFilledFromBill = true;
            } catch (error) {
              applyError = error;
            }
          }
        } catch (error) {
          extractionError = error;
        }
      }

      if (extractionError || applyError) {
        appToast.error({
          title: extractionError
            ? 'Draft created, but the bill could not be read'
            : 'Draft created, but it could not be filled from the bill',
          description: getApiErrorMessage(
            extractionError ?? applyError,
            'Your files were uploaded. Use Read again in Document review, or fill the draft in yourself.',
          ),
        });
      } else if (isFilledFromBill) {
        appToast.success({
          title: 'Draft filled from the bill',
          description: 'Check the fields marked "from bill", then confirm.',
        });
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all() });

      await navigate({
        to: '/maintenance-records/$recordId/edit',
        params: {
          recordId: draftRecord.id,
        },
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to start draft from documents',
        description: getApiErrorMessage(
          error,
          draftRecordId
            ? 'The draft was created, but the document flow did not finish cleanly.'
            : 'The upload-first draft could not be created.',
        ),
      });

      if (draftRecordId) {
        await navigate({
          to: '/maintenance-records/$recordId/edit',
          params: {
            recordId: draftRecordId,
          },
        });
      }
    } finally {
      setIsUploadFirstPending(false);
      // The same photo chosen again must still start a draft.
      input.value = '';
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

  const canRead = extractionStatusQuery.data?.available !== false;

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
            isSubmitting={createMaintenanceMutation.isPending || isUploadFirstPending}
            leading={
              <BillCapture
                canRead={canRead}
                isPending={isUploadFirstPending}
                onFiles={(event) => void handleUploadFirst(event)}
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
