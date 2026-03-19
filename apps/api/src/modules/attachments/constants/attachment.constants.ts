import { resolve } from 'node:path';

export const ATTACHMENTS_MAX_FILES = 10;
export const ATTACHMENTS_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ATTACHMENTS_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/**
 * Temporary local upload storage for MVP development.
 * File binaries live on disk here, while metadata remains in memory.
 */
export function getUploadsDirectory() {
  return resolve(process.cwd(), 'uploads');
}
