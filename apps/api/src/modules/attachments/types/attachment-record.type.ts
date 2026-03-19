import type { Attachment } from '@vehicle-vault/shared';

export type AttachmentRecord = Attachment & {
  filePath: string;
};
