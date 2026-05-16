# Deepening Plan — May 2026

Three deepening opportunities, designed via `/improve-codebase-architecture`. Decisions are recorded in `apps/api/CONTEXT.md` and ADRs 0001–0003. This file is the execution checklist.

## Overview

| # | Module             | Replaces                                                                 | ADR  |
| - | ------------------ | ------------------------------------------------------------------------ | ---- |
| 1 | `VehicleDocument`  | `InsuranceService`, `WarrantyService`                                    | 0001 |
| 3 | `TokenService`     | Token bits inside `AuthService`                                          | 0002 |
| 4 | `NotifyService`    | `NotificationsService.create` + alert orchestration in `MaintenanceAlertService` | 0003 |

Sequencing: **#3 → #4 → #1**. TokenService is independent; NotifyService is needed by #1's expiry loop; VehicleDocument is the integrating change.

---

## #3 — TokenService

### Files

- **New**: `apps/api/src/modules/auth/token.service.ts`, `token.service.spec.ts`
- **Edit**: `apps/api/src/modules/auth/auth.service.ts` (531 → ~250 lines)
- **Edit**: `apps/api/src/modules/auth/auth.module.ts` (provide `TokenService`, export for guards)
- **New migration**: `prisma/migrations/<timestamp>_add_email_verification_token_expires_at/`

### Interface

```ts
type IssuedToken = { token: string; url: string };

class TokenService {
  // private: hash(t), generate(bytes=32), timingSafeCompare(a, b)

  issueEmailVerification(userId: string): Promise<IssuedToken>     // 7-day TTL
  consumeEmailVerification(token: string): Promise<User>           // throws on invalid/expired

  issuePasswordReset(userId: string): Promise<IssuedToken>         // 30-min TTL
  consumePasswordReset(token: string): Promise<User>

  rotateRefreshToken(user: AuthUser): Promise<string>              // signs JWT + persists hash
  verifyRefreshToken(jwt: string): Promise<User>                   // JWT verify + timing-safe hash compare
  revokeRefreshToken(userId: string): Promise<void>
}
```

### Schema

```prisma
model User {
  // existing fields...
  emailVerificationTokenHash       String?
  emailVerificationTokenExpiresAt  DateTime?  // NEW
}
```

Migration backfills existing unverified users with `now() + 7 days` so they don't lock out immediately.

### Security fixes folded in

- All hash compares use `crypto.timingSafeEqual` (replaces `!==` at L147, L325 in current `auth.service.ts`)
- Email verification gains TTL (closes indefinite replay window)

### Test surface

- TokenService unit tests with mocked Prisma — issue/consume per purpose, expired path, reuse path, invalid path
- Timing-safe compare regression test
- AuthService tests shrink to orchestration (DTO validation, mail send wiring, response shape)

### Verification

- `pnpm --filter @vehicle-vault/api test auth token` passes
- `pnpm --filter @vehicle-vault/api e2e` covers register → receive email → verify → login → refresh → logout
- Manual: password reset flow end-to-end with expired token rejected

---

## #4 — NotifyService

### Files

- **New**: `apps/api/src/modules/notifications/notify.service.ts`, `notify.service.spec.ts`
- **New**: `apps/api/src/modules/notifications/templates/` (one file per `AlertKind`)
- **New**: `apps/api/src/modules/notifications/channels/email.channel.ts`
- **Edit**: `apps/api/src/modules/notifications/maintenance-alert.service.ts` (~200L → ~40L)
- **Delete or rename**: `NotificationsService.create` superseded by `NotifyService.raise`. Keep read methods (`findAll`, `getUnreadCount`, `markAsRead`, `markAllAsRead`).
- **New migration**: `prisma/migrations/<timestamp>_notification_kind_and_dedup_key/`

### Interface

```ts
type AlertKind =
  | 'maintenance-due'
  | 'maintenance-overdue'
  | 'reminder-due'
  | 'reminder-overdue'
  | 'document-expiring';

interface AlertTemplate<TPayload> {
  kind: AlertKind;
  dedupKey(payload: TPayload): string;
  render(payload: TPayload, ctx: UserContext): {
    title: string; message: string;
    type: 'info'|'warning'|'error'|'success';
    link: string;
  };
}

interface Channel {
  name: string;
  deliver(notification: Notification, user: User): Promise<void>;
}

class NotifyService {
  raise<K extends AlertKind>(
    userId: string, vehicleId: string | null,
    kind: K, payload: PayloadFor<K>,
  ): Promise<Notification>;
}
```

### Schema

```prisma
model Notification {
  // existing fields...
  kind      String   @default("legacy")  // NEW
  dedupKey  String?                       // NEW

  @@unique([userId, dedupKey], map: "notification_dedup_unread")
  // Partial: WHERE isRead = false (declared as raw SQL in migration; Prisma doesn't model partial unique natively)
}
```

Migration creates the partial unique index via raw SQL:

```sql
CREATE UNIQUE INDEX notification_dedup_unread
  ON "Notification" ("userId", "dedupKey")
  WHERE "isRead" = false AND "dedupKey" IS NOT NULL;
```

### Templates (one per kind)

- `maintenance-due.template.ts` — payload `{ category, remainingDistance, vehicleSummary }`; dedupKey `maintenance-due:${vehicleId}:${category}`
- `maintenance-overdue.template.ts` — same payload; dedupKey `maintenance-overdue:${vehicleId}:${category}`
- `reminder-due.template.ts` — payload `{ reminderId, dueOdometer, currentOdometer }`; dedupKey `reminder-due:${reminderId}`
- `reminder-overdue.template.ts` — same; dedupKey `reminder-overdue:${reminderId}`
- `document-expiring.template.ts` — payload `{ document, daysUntilExpiry }`; dedupKey `document-expiring:${document.id}:${daysBucket(daysUntilExpiry)}` where `daysBucket` collapses 1–7 → "7d", 8–30 → "30d"

### Channels

- `EmailChannel` — wraps `MailService.sendMaintenanceAlert` (renamed/generalised). Real adapter.
- (Future) `PushChannel`, `SmsChannel` — interface designed for them; not implemented now.

Honesty: only one real channel today → "hypothetical seam" per LANGUAGE.md. Earns "real seam" status when second channel lands. Worth designing now because the alternative — inlining `mailService` in every producer — is exactly what we're escaping.

### Test surface

- 1 template test per kind: render snapshot + dedupKey stability across payload variations
- `EmailChannel` test with mocked `MailService`
- NotifyService integration: dedup skips duplicate; `Promise.allSettled` keeps record when channel fails
- `MaintenanceAlertService` tests shrink to "right kind raised when threshold crossed"

### Verification

- `pnpm --filter @vehicle-vault/api test notifications` passes
- E2E: create vehicle, age maintenance past interval, run cron, observe one notification + one email
- Re-run cron → no duplicate notification (dedup test)
- Simulate mail transport failure → notification still written, log captures channel error

---

## #1 — VehicleDocument

### Files

- **New**: `apps/api/src/modules/vehicle-documents/vehicle-documents.module.ts`, `.service.ts`, `.controller.ts`, `.service.spec.ts`
- **New**: `apps/api/src/modules/vehicle-documents/adapters/insurance.adapter.ts`, `warranty.adapter.ts`
- **New**: `apps/api/src/modules/vehicle-documents/templates/` — moves `document-expiring.template.ts` here (or imports from `notifications/templates`)
- **Delete**: `apps/api/src/modules/insurance/` (entire folder), `apps/api/src/modules/warranty/` (entire folder)
- **Edit**: `apps/api/src/app.module.ts` (swap imports)
- **Edit**: `apps/api/src/modules/notifications/maintenance-alert.service.ts` — drop `checkInsurancePolicies`, replace with single loop:
  ```ts
  const expiring = await this.vehicleDocuments.findExpiring(vehicle.userId, 7);
  for (const doc of expiring) {
    await this.notify.raise(vehicle.userId, doc.vehicleId, 'document-expiring',
      { document: doc, daysUntilExpiry: 7 });
  }
  ```
- **Edit web**: `apps/web/src/features/insurance/`, `apps/web/src/features/warranty/` — point to unified `/vehicles/:vehicleId/documents?kind=` route. Likely also collapse into `apps/web/src/features/vehicle-documents/`.
- **New migration**: `prisma/migrations/<timestamp>_attachment_polymorphic_owner/`

### Interface

```ts
type VehicleDocumentKind = 'insurance' | 'warranty';
// future: 'registration' | 'puc' | 'road_tax'

type VehicleDocument = {
  id: string; vehicleId: string; kind: VehicleDocumentKind;
  provider: string; number: string | null;
  startDate: Date; endDate: Date | null;
  notes: string | null;
  details: Record<string, unknown>;   // kind-specific (premiumAmount, type, endOdometer)
};

class VehicleDocumentsService {
  create(userId, vehicleId, kind, payload): Promise<VehicleDocument>
  update(userId, id, payload): Promise<VehicleDocument>
  remove(userId, id): Promise<void>
  listForVehicle(userId, vehicleId, kind?): Promise<VehicleDocument[]>
  findExpiring(userId, withinDays, kind?): Promise<VehicleDocument[]>     // range query, replaces buggy 1-day slice
  activeCoverageAt(vehicleId, date, kind?): Promise<VehicleDocument[]>
}

interface VehicleDocumentAdapter<TRow, TCreate, TUpdate> {
  kind: VehicleDocumentKind;
  toDocument(row: TRow): VehicleDocument;
  toCreateInput(input: TCreate, vehicleId: string): unknown;
  toUpdateInput(input: TUpdate): unknown;
  // table accessor on PrismaService
}
```

### Schema (Attachment polymorphic owner)

```prisma
model Attachment {
  id                  String   @id @default(uuid()) @db.Uuid
  maintenanceRecordId String?  @db.Uuid                 // CHANGED: was required
  vehicleDocumentId   String?  @db.Uuid                 // NEW
  // existing fields...
  maintenanceRecord   MaintenanceRecord? @relation(...)
  vehicleDocument     VehicleDocument?   @relation(...)

  @@index([maintenanceRecordId, uploadedAt(sort: Desc)])
  @@index([vehicleDocumentId, uploadedAt(sort: Desc)])
}
```

Add CHECK constraint so exactly one owner is non-null:

```sql
ALTER TABLE "Attachment"
  ADD CONSTRAINT attachment_owner_exclusive
  CHECK (
    (("maintenanceRecordId" IS NOT NULL)::int +
     ("vehicleDocumentId"   IS NOT NULL)::int) = 1
  );
```

NOTE: no separate `VehicleDocument` table — insurance + warranty rows stay in `InsurancePolicy` + `Warranty`. The `vehicleDocumentId` FK on Attachment is actually polymorphic across those tables; pick one of:

- **(a)** Single `vehicleDocumentId` UUID without DB-level FK (app-level integrity via adapter)
- **(b)** Two columns: `insurancePolicyId?` + `warrantyId?` (typed FKs, more columns as kinds grow)
- **(c)** Introduce a thin `VehicleDocument` parent table with just `(id, kind)` and existing tables FK to it (cleanest, biggest migration — defer until kinds grow)

**Recommendation: (b) for now.** Attachment gains two nullable typed FKs (`insurancePolicyId`, `warrantyId`), keeps the CHECK-one-owner constraint extended to all owner columns. When a 3rd doc kind lands, revisit and pick (c).

### Controller (unified URL)

```ts
@Controller('vehicles/:vehicleId/documents')
class VehicleDocumentsController {
  @Get()        list(userId, vehicleId, @Query('kind') kind?)
  @Post()       create(userId, vehicleId, @Body() { kind, ...payload })
  @Patch(':id') update(userId, id, @Body() payload)
  @Delete(':id') remove(userId, id)
}
```

Old routes `/vehicles/:id/insurance` and `/vehicles/:id/warranty` removed. Web migrated.

### Test surface

- 1 adapter mapping test per kind (Insurance, Warranty)
- `findExpiring` integration: boundary cases (endDate today, today+N inclusive, kind filter)
- `activeCoverageAt` integration: overlap, gap, exact-end-of-coverage
- Controller test (1 file) — kind-discriminated create/list/update/remove
- Web smoke: insurance + warranty CRUD via new `/documents` endpoint

### Verification

- `pnpm --filter @vehicle-vault/api test vehicle-documents` passes
- Existing `insurance` and `warranty` test files deleted (logic moved + grown)
- E2E: add insurance with `endDate = today+5`, run cron, observe single `document-expiring` notification with `dedupKey insurance:<id>:7d`
- E2E: add warranty with `endDate = today+3`, run cron, observe second `document-expiring` notification with distinct dedupKey
- Web: insurance UI lists, creates, edits, deletes against new `/documents` endpoint

---

## Sequencing rationale

1. **#3 first** — independent. No coupling to #1 or #4. Lands the security fix (timing-safe compare, 7-day TTL).
2. **#4 second** — depends on nothing structurally; the `document-expiring` template will use a stub `VehicleDocument` type until #1 lands, swapped at integration.
3. **#1 third** — integrates with both. Deletes insurance/warranty modules, wires `findExpiring` into the cron loop, completes the depth payoff.

Each can land as a separate PR. Don't bundle.

## Cross-cutting cleanup (out of scope, list for later)

- **Decimal/Date mapping helpers** (candidate #5 in the original audit) — pull into shared util after #1 lands; insurance/warranty currently do their own conversions.
- **Web hooks layer** (candidate #2) — separate cleanup PR.
- **Dashboard fan-out** (candidate #6) — depends on stable VehicleDocument; revisit after #1.
