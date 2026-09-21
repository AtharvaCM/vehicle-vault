# AuditEvent design: no-FK polymorphic subject, in-transaction writes, anonymize-on-delete

**Status**: accepted

`AuditEvent` is the immutable history table for mutations and auth events. Three coupled decisions define how it works:

1. **Subject reference is a typed enum + uuid string, with no foreign key.** The row carries `resourceType: AuditResourceType` and `resourceId: String`, never a `vehicleId` / `maintenanceRecordId` / etc. FK column. The audit table is the one place where an orphan reference is the correct outcome — when a vehicle is deleted, the audit row recording "Alice deleted vehicle X at T" must survive that deletion. The house pattern for polymorphic owners (`Attachment` with nullable FK pair + CHECK-one-owner) is the opposite shape because attachments should cascade-delete with their parent; the symmetry argument doesn't apply here.

2. **Audit writes happen inside the same `prisma.$transaction` as the mutation they describe.** A wrapper `auditService.track(tx, { actorUserId, action, resourceType, resourceId, before, after, ownerUserId })` is invoked from the service method after the mutation, both inside the same `tx`. This buys atomicity: a mutation either commits with its audit row or both roll back together — the log can never silently miss a committed change, and a failed mutation can never leave a phantom audit row. The alternatives we rejected: Prisma middleware can't see auth events and doesn't know the verb; a Nest interceptor can't read the pre-image needed for the diff. A dev/CI-only Prisma `$extends` hook flags mutations whose tx didn't emit a matching audit event, catching forgotten call sites without blocking prod writes.

3. **Retention is forever; account deletion anonymizes rather than purges.** When a user is deleted, their audit rows have `actorUserId` and `ownerUserId` set to null and any PII fields scrubbed from `before`/`after` payloads. The rows themselves stay — timestamps, action verbs, and resource ids remain queryable so the security trail isn't erased by deleting an account. This works because the `actorUserId` FK is already `onDelete: SetNull` and the subject reference has no FK, so the orphan is the _desired_ terminal state.

A future contributor will reach for one or more "simplifications": adding per-type FK columns for "type safety," wiring audit emission through a Prisma middleware to "DRY up the service code," or adding a TTL purge to "control table growth." Resist all three. They each look like cleanups and each breaks a property the design depends on — that audit rows outlive their subjects, that an audit event and its mutation share an atomic outcome, and that the history survives the actor.

## Amendment, 2026-09-21: what anonymisation scrubs

Anonymisation first ran for real when the e2e test accounts were purged (#93), and the write-time deny-list turned out to be the wrong tool for it: it removes secrets (hashes, tokens), not identity, so `auth.account_created` rows still carried the deleted person's name and email. Identity cannot be listed field by field — names, registration numbers and free-text notes are all personal — so `anonymiseForUser` now blanks **every payload value** (keys kept, so which fields changed still reads) on rows about the deleted user's own data.

It also stops unlinking other people. The first version nulled `ownerUserId` on every row the user touched, which would have pulled an editor's changes out of the remaining owner's activity log. Now the owner link and payload go only where the deleted user was the owner; where they were the actor on someone else's data, only the actor, IP address and user agent go.
