import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import heicConvert from 'heic-convert';

import {
  ATTACHMENTS_ALLOWED_EXTENSIONS_BY_MIME_TYPE,
  ATTACHMENTS_ALLOWED_MIME_TYPES,
  ATTACHMENTS_MAX_FILE_SIZE_BYTES,
  ATTACHMENTS_MAX_ORIGINAL_FILE_NAME_LENGTH,
} from '../constants/attachment.constants';
import type { AttachmentUploadFile } from '../types/attachment-upload-file.type';

type SupportedAttachmentMimeType = (typeof ATTACHMENTS_ALLOWED_MIME_TYPES)[number];

type PreparedAttachmentUploadFile = {
  buffer: Buffer;
  mimeType: SupportedAttachmentMimeType;
  originalFileName: string;
  size: number;
  storageExtension: string;
};

export function attachmentFileFilter(
  _request: unknown,
  file: AttachmentUploadFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (resolveAttachmentMimeType(file)) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException(
      'Unsupported file type. Allowed types: JPEG, PNG, WEBP, HEIC, HEIF, and PDF.',
    ),
    false,
  );
}

export function isSupportedAttachmentMimeType(
  mimeType: string,
): mimeType is SupportedAttachmentMimeType {
  return ATTACHMENTS_ALLOWED_MIME_TYPES.some((allowedMimeType) => allowedMimeType === mimeType);
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
  const mimeType = resolveAttachmentMimeType(file, originalFileName);

  if (!mimeType) {
    throw new BadRequestException(
      'Unsupported file type. Allowed types: JPEG, PNG, WEBP, HEIC, HEIF, and PDF.',
    );
  }

  if (!file.size || file.buffer.byteLength === 0) {
    throw new BadRequestException('Uploaded files cannot be empty.');
  }

  if (file.size > ATTACHMENTS_MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException('Each file must be 5 MB or smaller.');
  }

  const extension = extname(originalFileName).toLowerCase();
  const allowedExtensions = ATTACHMENTS_ALLOWED_EXTENSIONS_BY_MIME_TYPE[mimeType];

  if (!allowedExtensions.includes(extension as never)) {
    throw new BadRequestException('The file extension does not match the uploaded file type.');
  }

  if (!matchesAttachmentFileSignature(file.buffer, mimeType)) {
    throw new BadRequestException('Uploaded file content does not match the declared file type.');
  }

  return { mimeType, originalFileName };
}

export async function convertHeicToJpegIfNeeded(
  file: AttachmentUploadFile,
): Promise<PreparedAttachmentUploadFile> {
  const { mimeType, originalFileName } = validateAttachmentUploadFile(file);

  if (!isHeicMimeType(mimeType)) {
    return {
      buffer: file.buffer,
      mimeType,
      originalFileName,
      size: file.size,
      storageExtension: extname(originalFileName).toLowerCase(),
    };
  }

  let converted: Buffer;

  try {
    const output = await heicConvert({
      buffer: file.buffer,
      format: 'JPEG',
      quality: 0.9,
    });
    converted = toBuffer(output);
  } catch {
    throw new BadRequestException('HEIC image could not be converted to JPEG.');
  }

  if (converted.byteLength > ATTACHMENTS_MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException('Each file must be 5 MB or smaller.');
  }

  if (!matchesAttachmentFileSignature(converted, 'image/jpeg')) {
    throw new BadRequestException('Converted HEIC image did not produce a valid JPEG.');
  }

  return {
    buffer: converted,
    mimeType: 'image/jpeg',
    originalFileName,
    size: converted.byteLength,
    storageExtension: '.jpg',
  };
}

export function buildStoredFileName(originalFileName: string, storageExtension?: string) {
  return `${randomUUID()}${storageExtension ?? extname(originalFileName)}`;
}

export function buildStoredAttachmentPath(
  userId: string,
  maintenanceRecordId: string,
  originalFileName: string,
  storageExtension?: string,
) {
  return `attachments/${userId}/${maintenanceRecordId}/${buildStoredFileName(
    originalFileName,
    storageExtension,
  )}`;
}

function isHeicMimeType(mimeType: string) {
  return mimeType === 'image/heic' || mimeType === 'image/heif';
}

function resolveAttachmentMimeType(
  file: AttachmentUploadFile,
  originalFileName = file.originalname,
): SupportedAttachmentMimeType | null {
  if (isSupportedAttachmentMimeType(file.mimetype)) {
    return file.mimetype;
  }

  const extension = extname(originalFileName).toLowerCase();

  if ((file.mimetype === 'application/octet-stream' || !file.mimetype) && extension === '.heic') {
    return 'image/heic';
  }

  if ((file.mimetype === 'application/octet-stream' || !file.mimetype) && extension === '.heif') {
    return 'image/heif';
  }

  return null;
}

function toBuffer(output: ArrayBuffer | Buffer | Uint8Array) {
  if (Buffer.isBuffer(output)) {
    return output;
  }

  if (output instanceof ArrayBuffer) {
    return Buffer.from(output);
  }

  return Buffer.from(output.buffer, output.byteOffset, output.byteLength);
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
    case 'image/heic':
    case 'image/heif':
      return matchesHeifFileSignature(buffer);
    default:
      return false;
  }
}

function matchesHeifFileSignature(buffer: Buffer) {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
    return false;
  }

  const brand = buffer.subarray(8, 12).toString('ascii');
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
}
