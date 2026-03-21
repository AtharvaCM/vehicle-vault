import { BadRequestException } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, extname, resolve } from 'node:path';

import {
  ATTACHMENTS_ALLOWED_EXTENSIONS_BY_MIME_TYPE,
  ATTACHMENTS_ALLOWED_MIME_TYPES,
  ATTACHMENTS_MAX_FILE_SIZE_BYTES,
  ATTACHMENTS_MAX_ORIGINAL_FILE_NAME_LENGTH,
  getUploadsDirectory,
} from '../constants/attachment.constants';
import type { AttachmentUploadFile } from '../types/attachment-upload-file.type';

export function attachmentFileFilter(
  _request: unknown,
  file: AttachmentUploadFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (isSupportedAttachmentMimeType(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException('Unsupported file type. Allowed types: JPEG, PNG, WEBP, and PDF.'),
    false,
  );
}

export function isSupportedAttachmentMimeType(
  mimeType: string,
): mimeType is (typeof ATTACHMENTS_ALLOWED_MIME_TYPES)[number] {
  return ATTACHMENTS_ALLOWED_MIME_TYPES.some((allowedMimeType) => allowedMimeType === mimeType);
}

export function ensureUploadsDirectory() {
  mkdirSync(getUploadsDirectory(), { recursive: true });
}

export function getAttachmentAbsolutePath(fileName: string) {
  return resolve(getUploadsDirectory(), fileName);
}

export async function deleteStoredAttachmentFile(fileName: string) {
  try {
    await unlink(getAttachmentAbsolutePath(fileName));
  } catch (error) {
    const fileDeletionError = error as NodeJS.ErrnoException;

    if (fileDeletionError.code !== 'ENOENT') {
      throw fileDeletionError;
    }
  }
}

export function sanitizeOriginalFileName(originalFileName: string) {
  const normalizedFileName = basename(originalFileName).trim();

  if (!normalizedFileName) {
    throw new BadRequestException('Attachment file name is required.');
  }

  if (normalizedFileName.length > ATTACHMENTS_MAX_ORIGINAL_FILE_NAME_LENGTH) {
    throw new BadRequestException('Attachment file names must be 180 characters or fewer.');
  }

  return normalizedFileName;
}

export function validateAttachmentUploadFile(file: AttachmentUploadFile) {
  const originalFileName = sanitizeOriginalFileName(file.originalname);

  if (!isSupportedAttachmentMimeType(file.mimetype)) {
    throw new BadRequestException(
      'Unsupported file type. Allowed types: JPEG, PNG, WEBP, and PDF.',
    );
  }

  if (!file.size || file.buffer.byteLength === 0) {
    throw new BadRequestException('Uploaded files cannot be empty.');
  }

  if (file.size > ATTACHMENTS_MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException('Each file must be 5 MB or smaller.');
  }

  const extension = extname(originalFileName).toLowerCase();
  const allowedExtensions = ATTACHMENTS_ALLOWED_EXTENSIONS_BY_MIME_TYPE[file.mimetype];

  if (!allowedExtensions.includes(extension as never)) {
    throw new BadRequestException('The file extension does not match the uploaded file type.');
  }

  if (!matchesAttachmentFileSignature(file.buffer, file.mimetype)) {
    throw new BadRequestException('Uploaded file content does not match the declared file type.');
  }

  return originalFileName;
}

export function buildStoredFileName(originalFileName: string) {
  return `${randomUUID()}${extname(originalFileName)}`;
}

function matchesAttachmentFileSignature(buffer: Buffer, mimeType: string) {
  switch (mimeType) {
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'image/png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    default:
      return false;
  }
}
