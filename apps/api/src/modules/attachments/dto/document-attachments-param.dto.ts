import { IsIn } from 'class-validator';

import { IsUuidRouteParam } from '../../../common/validators/is-uuid-route-param.validator';
import type { DocumentAttachmentKind } from '../attachments.service';

/** Every vehicle document kind owns its files. */
export const DOCUMENT_ATTACHMENT_KINDS: readonly DocumentAttachmentKind[] = [
  'insurance',
  'warranty',
  'registration',
  'puc',
  'road_tax',
];

export class DocumentAttachmentsParamDto {
  @IsIn(DOCUMENT_ATTACHMENT_KINDS)
  kind!: DocumentAttachmentKind;

  @IsUuidRouteParam()
  documentId!: string;
}
