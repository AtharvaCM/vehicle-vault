import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, ScanText } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { applyAttachmentExtraction } from '@/features/attachments/api/apply-attachment-extraction';
import { uploadAttachments } from '@/features/attachments/api/upload-attachments';
import { extractAttachment } from '@/features/attachments/api/extract-attachment';
import { extractAttachments } from '@/features/attachments/api/extract-attachments';
import { useAttachmentExtractionStatus } from '@/features/attachments/hooks/use-attachment-extraction-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { queryKeys } from '@/lib/query/query-keys';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { MaintenanceClaimLinkCard } from '@/features/claims/components/maintenance-claim-link-card';

import { MaintenanceForm } from '../components/maintenance-form';
import { useCreateMaintenanceDraft } from '../hooks/use-create-maintenance-draft';
import { useCreateMaintenanceRecord } from '../hooks/use-create-maintenance-record';
import { hasBillValues } from '../utils/get-fields-from-bill';

type VehicleMaintenanceCreatePageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceCreatePage({ vehicleId }: VehicleMaintenanceCreatePageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadFirstPending, setIsUploadFirstPending] = useState(false);
  const uploadFirstInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleQuery = useVehicle(vehicleId);
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const createMaintenanceMutation = useCreateMaintenanceRecord(vehicleId);
  const createDraftMutation = useCreateMaintenanceDraft(vehicleId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved service details. Leave without saving?',
  });

  async function handleCreateMaintenanceRecord(
    values: Parameters<typeof createMaintenanceMutation.mutateAsync>[0],
  ) {
    try {
      const created = await createMaintenanceMutation.mutateAsync(values);
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
          to: '/vehicles/$vehicleId/maintenance',
          params: {
            vehicleId,
          },
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
    const files = Array.from(event.target.files ?? []);

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

      if (uploadFirstInputRef.current) {
        uploadFirstInputRef.current.value = '';
      }
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
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to vehicles
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
          title="Add service record"
        />
        <ViewOnlyNotice
          action={
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/maintenance"
            >
              Back to maintenance
            </Link>
          }
          description="You can read this vehicle's service history, but not log new entries for it."
        />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer>
        <PageTitle
          description={`Log a service, repair, or inspection for ${vehicleTitle}.`}
          title="Add service record"
        />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <MaintenanceForm
            currentOdometer={vehicleQuery.data?.odometer}
            isSubmitting={createMaintenanceMutation.isPending || isUploadFirstPending}
            onDirtyChange={setIsDirty}
            onSubmit={handleCreateMaintenanceRecord}
            submitError={submitError}
            vehicleId={vehicleId}
          />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload first</CardTitle>
                <CardDescription>
                  Start with the invoice or job card and turn it into a draft before you type
                  anything.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  This creates a draft, uploads the files and reads them, then opens the draft
                  filled in from the bill for you to check and confirm.
                </p>
                <Button
                  className="w-full justify-center gap-2"
                  disabled={isUploadFirstPending}
                  onClick={() => uploadFirstInputRef.current?.click()}
                  type="button"
                >
                  {isUploadFirstPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanText className="h-4 w-4" />
                  )}
                  {isUploadFirstPending ? 'Creating draft...' : 'Upload job card first'}
                </Button>
                <input
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  className="sr-only"
                  multiple
                  onChange={handleUploadFirst}
                  ref={uploadFirstInputRef}
                  type="file"
                  capture="environment"
                />
                <p className="text-xs text-slate-500">
                  {extractionStatusQuery.data?.available === false
                    ? 'OCR is not configured right now, but draft upload still works.'
                    : 'OCR will run automatically after upload when available.'}
                </p>
              </CardContent>
            </Card>

            <MaintenanceClaimLinkCard vehicleId={vehicleId} />

            <Card>
              <CardHeader>
                <CardTitle>What to capture</CardTitle>
                <CardDescription>
                  One entry should represent one completed visit, repair, or service job.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <p>
                  Quick entry is best when you only need the date, category, odometer, and total.
                </p>
                <p>
                  Detailed entry lets you break the invoice into jobs, parts, fluids, taxes, and
                  discounts.
                </p>
                <p>
                  Workshop is optional, so self-done work and roadside fixes can still be logged.
                </p>
                <p>
                  After saving, you can still attach invoices, job cards, or photos to this entry.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </VehicleAccessProvider>
  );
}
