import { BadRequestException } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  ATTACHMENTS_ALLOWED_MIME_TYPES,
  getUploadsDirectory,
} from '../constants/attachment.constants';
import type { AttachmentUploadFile } from '../types/attachment-upload-file.type';

export function attachmentFileFilter(
  _request: unknown,
  file: AttachmentUploadFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (ATTACHMENTS_ALLOWED_MIME_TYPES.some((allowedMimeType) => allowedMimeType === file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException('Unsupported file type. Allowed types: JPEG, PNG, WEBP, and PDF.'),
    false,
  );
}

export function ensureUploadsDirectory() {
  mkdirSync(getUploadsDirectory(), { recursive: true });
}

export function buildStoredFileName(originalFileName: string) {
  return `${randomUUID()}${extname(originalFileName)}`;
}
