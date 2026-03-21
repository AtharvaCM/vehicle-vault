export const ATTACHMENTS_MAX_FILES = 10;
export const ATTACHMENTS_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ATTACHMENTS_MAX_ORIGINAL_FILE_NAME_LENGTH = 180;
export const ATTACHMENTS_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const ATTACHMENTS_ALLOWED_EXTENSIONS_BY_MIME_TYPE = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
} as const;
