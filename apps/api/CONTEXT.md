# API

NestJS backend for vehicle-vault. Owns the persistence model and business rules for vehicles and everything attached to them.

## Architecture facts

- NestJS 10, PostgreSQL via Prisma, ~22 modules under `src/modules/`. Global route prefix `api`; Swagger at `/api/docs`.
- **Every route is auth-protected by default** — `JwtAuthGuard` is a global `APP_GUARD` (registered in `AuthModule`); opt out with `@Public()`. Role gates via `@Roles(...)` + `RolesGuard`; per-vehicle access via **VehicleAccessService**.
- Global `ApiResponseInterceptor` wraps responses in `{success, data}` (binary/stream responses excluded); `GlobalExceptionFilter` produces `{success:false, error, meta}`.
- Validation is **mixed**: class-validator DTOs dominate (~42), with a minority of Zod DTOs using `ZodSchemaValidationPipe` + schemas from `@vehicle-vault/shared`. Not unified — known debt.
- Cron via `@nestjs/schedule`; the alert engine runs `MAINTENANCE_ALERT_CRON` (default `0 6 * * *`), **disabled when `NODE_ENV=development`**.
- **RLS**: enabled deny-by-default with no policies on all public tables. Intentional — the app connects as `postgres` (bypasses RLS); RLS only closes Supabase PostgREST exposure. No client-side RLS model exists.
- Storage: `SupabaseStorageService` with dual backend (Supabase Storage or local FS via `attachmentStorageBackend` — local used in CI).
- Config: `AppConfigService` typed wrapper. Note: JWT secrets have dev fallbacks with no prod startup assertion.
- Tests: Vitest, co-located `*.spec.ts` unit tests; no API-level e2e harness (web Playwright smoke covers it).

## Language

**Vehicle**:
A car or two-wheeler in a **User**'s garage. Root of most aggregates. Ownership is expressed through **VehicleMember** rows; `Vehicle.userId` survives as a legacy owner FK (still carries the `[userId, registrationNumber]` unique and cascade) — queries go through `members.some`, so **VehicleMember is authoritative**. A Vehicle may link to a **CatalogVariant** (`catalogVariantId`, fuzzy-matched by `VehicleCatalogLinkerService`).

**VehicleMember** / **VehicleRole**:
A **User**'s role on a **Vehicle**: `owner`, `editor`, or `viewer` (ranked). Enforced everywhere by **VehicleAccessService** (`assert`/`assertEditor`/`assertOwner`; throws NotFound to prevent id probing). Sharing happens via **VehicleInvite** (hashed token, expiry, accept/revoke) and ownership transfer.

**VehicleDocument**:
A time-bounded record of coverage or registration on a **Vehicle**. Has a provider, a validity window (`startDate`–`endDate`), and a `kind`: `insurance`, `warranty`, `registration`, `puc`, `road_tax`. Unified behind one service via per-kind adapters (`VEHICLE_DOCUMENT_ADAPTERS` DI multi-provider). Insurance and warranty persist in dedicated tables (`InsurancePolicy`, `Warranty`); the three **compliance kinds** (registration certificate, PUC, road tax) share one `ComplianceDocument` table discriminated by kind, since their field shape is identical (issuing authority, number, validity window, amount). A null `endDate` means never expires (e.g. lifetime road tax). See ADR-0001.
_Avoid_: Policy (insurance-only), Coverage (warranty-only).

**MaintenanceRecord**:
A single completed service visit. Has line items, costs, odometer, `status` (draft/confirmed), optional extraction-backed attachment, optional 1:1 **Claim** link. **Not** a **VehicleDocument** — different shape (line items, currency math) and different behaviour (forecasting, extraction ingestion). See ADR-0001.

**Accessory**:
Something bought for a **Vehicle** and optionally fitted to it — mats, a dashcam, alloys. Has a purchase date and cost, an optional fitted/removed lifecycle (`removedDate` null with a `fittedDate` present means currently fitted), and an optional `warrantyExpiresAt` that the **AlertEngine** treats like a document expiry. **Not** a **MaintenanceRecord**: a purchase has no service date and no odometer reading at time of service, and counting it as maintenance corrupts the ₹/km figure maintenance history exists to produce. Its `category` is free text on purpose — a premature enum is what pushed accessories into `MaintenanceCategory` before this table existed. Not transferable between vehicles.
_Avoid_: part (a **MaintenanceLineItem** kind), upgrade, mod.

**Claim**:
An insurance claim on a **Vehicle**, tied to an **InsurancePolicy**, optionally linked 1:1 to the **MaintenanceRecord** that repaired the damage. Has its own attachments and extraction kind.

**VehicleLoan**:
A financing record on a **Vehicle**: amortization schedule (EMI math in `vehicle-loans/amortization.ts`), prepayments, foreclosure, attachments, and its own extraction kind (`loan_document`).

**Reminder**:
A future-dated to-do tied to a **Vehicle**, optionally with `dueOdometer`. Drives both UI surfaces and the alert engine. Service-schedule suggestions come from `ServiceScheduleService` + `service-schedule-catalog.ts`.

**Notification**:
A user-facing message persisted per **User** with a `kind` and a `dedupKey`. Uniqueness for unread notifications enforced by partial unique index on `(userId, dedupKey) WHERE isRead = false`; a dedup collision returns the existing unread row rather than throwing. See ADR-0003.

**AlertKind**:
A typed alert category — `maintenance-due`, `maintenance-overdue`, `reminder-due`, `reminder-overdue`, `document-expiring`, `accessory-warranty-expiring`, `tyre-worn`, `tyre-aged`, `tyre-uninspected`, `service-baseline-unknown`. Enumerated at runtime as `ALERT_KINDS` so a kind with no registered template fails a test rather than a cron run. Each kind has an **AlertTemplate** that owns content rendering and `dedupKey` computation.

**AlertTemplate**:
The per-**AlertKind** producer of notification content (title, message, link, urgency) and dedup identity. Wired via `ALERT_TEMPLATES` DI multi-provider behind **NotifyService**.

**Channel**:
An external delivery adapter for a **Notification** (`email` and `push` today; `sms` future). The DB row is the canonical record; channels are out-of-band fan-out (`Promise.allSettled`, failures logged not thrown). Push is web-push/VAPID (`PushSubscriptionsService`, gated on `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`); one **PushSubscription** row per browser endpoint, pruned automatically on 404/410.

**NotifyService**:
`raise(userId, vehicleId, kind, payload)` — resolves template, computes dedup key, upserts the row, and fans out to channels. The single entry point for raising any alert.

**AlertEngine** (`MaintenanceAlertService`):
The cron orchestrator that runs per-vehicle, reads current predicted odometer (`VehicleInsightsService`), and calls **NotifyService.raise** for each crossed threshold (intervals from `MaintenanceIntervalResolver`, reminders within 500 km of `dueOdometer`, documents expiring within 7 days via `VehicleDocumentsService.findExpiring`, tyre verdicts from `TyresService.getAlertState`, last-done odometers from **ServiceBaseline** rows loaded with the vehicle). Owns _when_ to alert, not _what_ the alert looks like.

**Tyre observation**:
The last time anyone had eyes on a **Tyre** — its newest **TyreInspection**, or its `fittedDate`/`fittedOdometer` when it has never been measured. `TyresService.getAlertState` reports the _oldest_ observation across a vehicle's road tyres (the spare is graded but excluded, since it covers none of the vehicle's mileage), and the **AlertEngine** raises `tyre-uninspected` once that observation is older than `TYRE_INSPECTION_INTERVAL_KM` / `_MONTHS`. The distinction this encodes: a tyre nobody has measured is **unknown**, not healthy, and unknown is a thing to say out loud rather than a reason to stay quiet.

**ServiceBaseline**:
What was known about one **MaintenanceCategory** on a **Vehicle** when it entered the vault — an odometer reading, a date, or an explicit `unknown`. Unique per `[vehicleId, category]`; a CHECK constraint keeps `known` carrying a figure and `unknown` carrying none.

Three states, not two, and the third is the absence of a row:

| State                          | Engine behaviour                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------- |
| A **MaintenanceRecord** exists | measured from the record — always wins over a baseline, which was a recollection |
| `known` with an odometer       | measured from the baseline                                                       |
| `known` with only a date       | no km alerting; the forecast owns month-based intervals                          |
| `unknown`                      | raises `service-baseline-unknown`, scope `category`                              |
| **no row**                     | the historical fallback: measured from `Vehicle.odometer`                        |

That last row is the behaviour this table exists to retire, and it is kept deliberately. Before **ServiceBaseline**, a category with no record was measured from the odometer at the moment the vehicle was added — silently asserting everything had just been done, so a bike added at 40 000 km was treated as having had its brake pads changed at 40 000 km. Every vehicle predating the table is in the no-row state, and reading it as `unknown` would greet each existing garage with one notification per service category. Users move out of it by answering, through `PUT /vehicles/:vehicleId/service-baseline`.
_Not_ a **MaintenanceRecord**: a baseline is what someone remembers, carries no cost, no line items and no attachment, and never contributes to ₹/km.

**Service intervals** — `vehicles/maintenance-interval.resolver.ts` is the single source of truth for "how often does this vehicle need X". It gates categories by vehicle type and fuel, and prefers per-variant `ServiceInterval` rows over its default table. `MaintenanceAlertService` and `MaintenanceForecastService` both consume it, and it is served to clients at `GET /vehicles/:vehicleId/intervals` so the web app never restates an interval locally — a client that picks its own number will disagree with the alert engine about the same vehicle.
_Caution_: `reminders/service-schedule-catalog.ts` still carries its own generic intervals for the reminder-suggestion flow, and some of its figures differ from the resolver's. It is scoped to "what reminders could I create", not "is this service due", but the two should be reconciled.

**Token**:
A credential issued to a **User** for a specific purpose: email verification, password reset, or refresh session. **TokenService** owns issue/consume/rotate/revoke lifecycle for all purposes, regardless of whether the bits are a JWT (refresh) or a SHA-256 hash of random bytes (verification, reset). Timing-safe comparisons. See ADR-0002.

**AuditEvent**:
An immutable record of one happened-thing in the system. Two flavours: a **mutation** against a tracked resource or an **auth event**. Dotted `action` string (`vehicle.updated`, `auth.login_failed`), optional `actorUserId`, polymorphic no-FK resource reference (`resourceType` enum + `resourceId`), diff payload (`before`/`after`/`changedFields`, PII-redacted). Written **inside the same transaction** as the mutation via `auditService.track(tx, …)`; a dev/CI safety net in `PrismaService.$transaction` throws `AuditCoverageError` when an audited mutation emits no event. Survives deletion of subject and actor. Rendered to end users as "Activity". See ADR-0004.
_Not_ a **Notification**; not a log line.

**Actor**:
The **User** who caused an **AuditEvent**, or `null` when no user can be resolved.

**DocumentExtraction**:
Structured data pulled from a user-uploaded file (image or PDF) by an AI provider. Has an **ExtractionKind**, an optional `confidence` score, a `provider` tag (`gemini` today via `GeminiExtractionProvider`, JSON-schema-constrained), and optionally a persisted row (e.g. `AttachmentExtraction`) kept for replay/audit. Output is a draft, never an authoritative record — the human always confirms via a form before the target resource is persisted. See ADR-0005.
_Not_ "OCR" — the provider reasons over the document. _Not_ "scan" — UI verb only.

**ExtractionKind**:
Discriminator for what shape the extracted JSON takes and which target resource the draft hydrates. Five today: `fuel_receipt`, `maintenance_invoice`, `insurance_policy`, `claim_document`, `loan_document`. Specs (schema + prompt + normalize) are co-located with their consumer module and register **imperatively** via `ExtractionRegistry.register()` in each module's `onModuleInit` — _not_ a DI multi-provider, despite ADR-0005's wording (known doc↔code divergence).

**Catalog**:
The India make → model → generation → variant → offering reference dataset (`VehicleCatalog*` models), with ~90-field variant specs, alias tables for fuzzy matching, and versioned **ImportRuns** with sha256-hashed snapshots. Fed by ~35 per-brand source snapshots under `prisma/catalog-import/sources/` (CarWale-scraped), imported via `catalog:import:*` scripts, curated via audit/backfill/pseudo-variant-cleanup tooling and an admin review UI. **VehicleCatalogLinkerService** fuzzy-links user Vehicles to variants.

**MaintenancePartCatalog**:
A **global, cross-user** self-learning table mapping normalized part names → suggested `MaintenanceCategory`, harvested from user line items. Powers category suggestion and part search. Not user-scoped (mild data-leakage consideration for part numbers).

## Module map

auth (register/login/refresh/OAuth/verify/reset), users, admin (user directory, force-logout, admin-email role reconciliation on boot), vehicles (CRUD, insights/forecast, catalog linking), vehicle-sharing (members/invites/transfer), vehicle-catalog (browse + import-run admin), maintenance (+ drafts, bulk, CSV), maintenance-parts, reminders (+ service-schedule), service-baseline (per-category history capture + coverage), fuel-logs (+ scan), vehicle-documents (insurance/warranty adapters + scan), claims (+ claim-attachments), vehicle-loans (+ amortization, scan), accessories (purchases + warranty expiry), attachments (polymorphic, extract/apply/reconciliation), notifications (NotifyService + AlertEngine + EmailChannel), audit, analytics (cost-split/cost-trend/TCO), dashboard, reports (service-history + resale PDFs), exports (account dump), extraction (`@Global` engine), health.

## Relationships

- A **Vehicle** has many **VehicleMembers**, **VehicleDocuments**, **MaintenanceRecords**, **Reminders**, **FuelLogs**, **Claims**, **VehicleLoans**, **Tyres**, **Accessories**, **ServiceBaselines**.
- The **AlertEngine** reads **ServiceBaseline** rows through the vehicle's own `include` rather than a service call — it runs once per vehicle across the whole table, and a baseline is a small child row of the vehicle already being read. `ServiceBaselineService.getCoverage` serves the same facts to clients, deliberately matching the engine's record lookup (unfiltered, ordered by odometer) so the screen explaining a reminder cannot disagree with the reminder.
- The **AlertEngine** reads **VehicleDocumentsService.findExpiring(withinDays)** (adapters implement `findExpiringBetween`) to produce expiry **Notifications**. It does not query document tables directly.
- The **AlertEngine** also reads **AccessoriesService.findExpiringWarranties(withinDays)** for the `accessory-warranty-expiring` kind. Accessory warranties raise **Notifications**, never **Reminders** — `Reminder` carries no pointer to a source record, and a date-only Reminder raises no alert at all.
- The **AlertEngine** reads **TyresService.getAlertState(userId, vehicleId)** for the three tyre kinds. Grading stays in **TyreConditionResolver** and reaches the notification as a rendered verdict, so the same numbers back the alert and the vehicle page — the engine never re-derives "is this tyre finished". Graded against `Vehicle.odometer`, not the predicted reading: a forecast must not be what declares a tyre worn.
- An **Attachment** has exactly one owner of five — **MaintenanceRecord**, **InsurancePolicy**, **Warranty**, **Claim**, or **VehicleLoan** — enforced by CHECK constraint `attachment_owner_exclusive`.

## Flagged ambiguities

- "Policy" was used to mean **InsurancePolicy** (Prisma model) and any **VehicleDocument**. Resolved: **InsurancePolicy** is the storage row for `kind=insurance`; the domain term is **VehicleDocument**.
- "OCR" / "scan" / "extraction" were used interchangeably. Resolved: domain term is **DocumentExtraction**; "scan" reserved for UI verbs; "OCR" deprecated.
- `Vehicle.userId` vs **VehicleMember**: dual ownership representation. Members are authoritative for access; `userId` remains for the registration-number unique and cascade. Candidate for consolidation.
- ADR-0005 describes spec registration as a DI multi-provider; the implementation is an imperative registry. Reconcile when next touching extraction.
