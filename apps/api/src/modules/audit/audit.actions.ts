/**
 * The audit vocabulary lives in `@vehicle-vault/shared` (the web says each
 * action in words, #318); re-exported here so the API's imports stay put.
 */
export { AUDIT_ACTIONS } from '@vehicle-vault/shared';

export type AuditAction = string;
