import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, ScanText } from 'lucide-react';
import { useRef, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { uploadAttachments } from '@/features/attachments/api/upload-attachments';
import { extractAttachment } from '@/features/attachments/api/extract-attachment';
import { useAttachmentExtractionStatus } from '@/features/attachments/hooks/use-attachment-extraction-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { MaintenanceForm } from '../components/maintenance-form';
import { useCreateMaintenanceDraft } from '../hooks/use-create-maintenance-draft';
import { useCreateMaintenanceRecord } from '../hooks/use-create-maintenance-record';

type VehicleMaintenanceCreatePageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceCreatePage({ vehicleId }: VehicleMaintenanceCreatePageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadFirstPending, setIsUploadFirstPending] = useState(false);
  const uploadFirstInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleQuery = useVehicle(vehicleId);
  const createMaintenanceMutation = useCreateMaintenanceRecord(vehicleId);
  const createDraftMutation = useCreateMaintenanceDraft(vehicleId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved maintenance details. Leave without saving?',
  });

  async function handleCreateMaintenanceRecord(
    values: Parameters<typeof createMaintenanceMutation.mutateAsync>[0],
  ) {
    try {
      await createMaintenanceMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: 'Maintenance record created',
        description: 'The service entry was added to this vehicle.',
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
        title: 'Unable to create maintenance record',
        description: getApiErrorMessage(error, 'Unable to create the maintenance record.'),
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

      if (canExtract) {
        await Promise.all(
          attachments.map((attachment) => extractAttachment(attachment.id).catch(() => undefined)),
        );
      }

      appToast.success({
        title: 'Draft created from documents',
        description: canExtract
          ? 'Your files were uploaded and OCR suggestions are ready for review.'
          : 'Your files were uploaded. OCR is unavailable, so finish the draft manually.',
      });

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
    ? getApiErrorMessage(
        createMaintenanceMutation.error,
        'Unable to create the maintenance record.',
      )
    : null;

  if (
    vehicleQuery.isError &&
    vehicleQuery.error instanceof ApiError &&
    vehicleQuery.error.status === 404
  ) {
    return (
      <PageContainer>
        <PageTitle
          description="Maintenance records can only be created for an existing vehicle."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so a maintenance record cannot be created for it."
          title="Vehicle not found"
        />
      </PageContainer>
    );
  }

  const vehicleTitle = vehicleQuery.data
    ? vehicleQuery.data.nickname?.trim() || `${vehicleQuery.data.make} ${vehicleQuery.data.model}`
    : 'Vehicle';

  return (
    <PageContainer>
      <PageTitle
        description={`Log a service, repair, or inspection for ${vehicleTitle}.`}
        title="Add Maintenance Record"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <MaintenanceForm
          isSubmitting={createMaintenanceMutation.isPending || isUploadFirstPending}
          onDirtyChange={setIsDirty}
          onSubmit={handleCreateMaintenanceRecord}
          submitError={submitError}
          vehicleId={vehicleId}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload First</CardTitle>
              <CardDescription>
                Start with the invoice or job card and turn it into a draft before you type
                anything.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
              <p>
                This creates a draft maintenance record, uploads the files, and runs OCR so you can
                review the extracted fields on the next screen.
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
                {isUploadFirstPending ? 'Creating Draft...' : 'Upload Job Card First'}
              </Button>
              <input
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                multiple
                onChange={handleUploadFirst}
                ref={uploadFirstInputRef}
                type="file"
              />
              <p className="text-xs text-slate-500">
                {extractionStatusQuery.data?.available === false
                  ? 'OCR is not configured right now, but draft upload still works.'
                  : 'OCR will run automatically after upload when available.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What to capture</CardTitle>
              <CardDescription>
                One entry should represent one completed visit, repair, or service job.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Quick Entry is best when you only need the date, category, odometer, and total.</p>
              <p>
                Detailed Entry lets you break the invoice into jobs, parts, fluids, taxes, and
                discounts.
              </p>
              <p>Workshop is optional, so self-done work and roadside fixes can still be logged.</p>
              <p>
                After saving, you can still attach invoices, job cards, or photos to this entry.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
