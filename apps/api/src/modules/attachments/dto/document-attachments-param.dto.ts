import { IsIn, IsUUID } from 'class-validator';

import type { DocumentAttachmentKind } from '../attachments.service';

/** The documents whose rows own their files: the compliance kinds do not yet. */
export const DOCUMENT_ATTACHMENT_KINDS: readonly DocumentAttachmentKind[] = [
  'insurance',
  'warranty',
];

export class DocumentAttachmentsParamDto {
  @IsIn(DOCUMENT_ATTACHMENT_KINDS)
  kind!: DocumentAttachmentKind;

  @IsUUID()
  documentId!: string;
}
