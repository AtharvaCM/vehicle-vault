import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ChangeEvent } from 'react';

import { applyAttachmentExtraction } from '@/features/attachments/api/apply-attachment-extraction';
import { extractAttachment } from '@/features/attachments/api/extract-attachment';
import { extractAttachments } from '@/features/attachments/api/extract-attachments';
import { uploadAttachments } from '@/features/attachments/api/upload-attachments';
import { useAttachmentExtractionStatus } from '@/features/attachments/hooks/use-attachment-extraction-status';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { queryKeys } from '@/lib/query/query-keys';
import { appToast } from '@/lib/toast';

import { hasBillValues } from '../utils/get-fields-from-bill';
import { useCreateMaintenanceDraft } from './use-create-maintenance-draft';

/**
 * The upload-first flow behind `BillCapture`: a draft record, the bill
 * uploaded to it and read, then the draft's confirm page. Shared by Log
 * service and the empty service log, so a first service can start from
 * the bill. `reminderId`: the reminder the draft completes when confirmed.
 */
export function useUploadFirstDraft(vehicleId: string, reminderId?: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const createDraftMutation = useCreateMaintenanceDraft(vehicleId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const canRead = extractionStatusQuery.data?.available !== false;

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      return;
    }

    let draftRecordId: string | null = null;
    // Logged from a reminder: confirming the draft completes it, as saving the form does.
    const toDraft = reminderId ? { search: { reminderId } } : {};
    setIsPending(true);

    try {
      const draftRecord = await createDraftMutation.mutateAsync();
      draftRecordId = draftRecord.id;
      const attachments = await uploadAttachments(draftRecord.id, files);
      // A failed read must not lose the draft or the uploads, but it must not pass
      // for a successful one either: the draft still opens, and its confirm page
      // says why the form is blank (see `DraftBillSummary`).
      let extractionError: unknown = null;
      let applyError: unknown = null;
      let isFilledFromBill = false;

      if (canRead) {
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
        ...toDraft,
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
          ...toDraft,
        });
      }
    } finally {
      setIsPending(false);
      // The same photo chosen again must still start a draft.
      input.value = '';
    }
  }

  return { canRead, isPending, onFiles };
}
