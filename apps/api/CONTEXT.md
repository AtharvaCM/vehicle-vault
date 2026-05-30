# API

NestJS backend for vehicle-vault. Owns the persistence model and business rules for vehicles and everything attached to them.

## Language

**Vehicle**:
A car or two-wheeler owned by a **User**. Root of most aggregates.

**VehicleDocument**:
A time-bounded record of coverage or registration on a **Vehicle**. Has a provider, a validity window (`startDate`–`endDate`), and a `kind` (currently `insurance`, `warranty`; future: `registration`, `puc`, `road_tax`). Persisted per-kind in dedicated tables; unified behind one service via per-kind adapters.
_Avoid_: Policy (insurance-only), Coverage (warranty-only).

**MaintenanceRecord**:
A single completed service visit. Has line items, costs, odometer, optional OCR-extracted attachment. **Not** a **VehicleDocument** — different shape (line items, currency math) and different behaviour (forecasting, OCR ingestion). See ADR-0001.

**Reminder**:
A future-dated to-do tied to a **Vehicle**, optionally with `dueOdometer`. Drives both UI surfaces and the alert engine.

**Notification**:
A user-facing message persisted per **User** with a `kind` and a `dedupKey`. Uniqueness for unread notifications enforced by partial unique index on `(userId, dedupKey) WHERE isRead = false`. See ADR-0003.

**AlertKind**:
A typed alert category — `maintenance-due`, `maintenance-overdue`, `reminder-due`, `reminder-overdue`, `document-expiring`. Each kind has an **AlertTemplate** that owns content rendering and `dedupKey` computation.

**AlertTemplate**:
The per-**AlertKind** producer of notification content (title, message, link, urgency) and dedup identity. Lives behind **NotifyService**.

**Channel**:
An external delivery adapter for a **Notification** (`email` today; `push`/`sms` future). The DB row is the canonical record; channels are out-of-band fan-out.

**NotifyService**:
`raise(userId, vehicleId, kind, payload)` — resolves template, computes dedup key, upserts the row, and fans out to channels via `Promise.allSettled`. The single entry point for raising any alert.

**AlertEngine** (`MaintenanceAlertService`):
The orchestrator that runs per-vehicle, reads current predicted odometer, and calls **NotifyService.raise** for each crossed threshold. Owns *when* to alert, not *what* the alert looks like.

**Token**:
A credential issued to a **User** for a specific purpose: email verification, password reset, or refresh session. **TokenService** owns issue/consume/rotate/revoke lifecycle for all purposes, regardless of whether the bits are a JWT (refresh) or a SHA-256 hash of random bytes (verification, reset). See ADR-0002.

**AuditEvent**:
An immutable record of one happened-thing in the system. Two flavours: a **mutation** against a tracked resource (vehicle, maintenance record, reminder, document, claim, fuel log, user) or an **auth event** (login success/failure, logout, password reset request/complete, email verify, OAuth link, account created). Each row has a dotted `action` string (`vehicle.updated`, `auth.login_failed`), an optional `actorUserId` (null only when the actor cannot be resolved — failed login on unknown email, future system events), an optional polymorphic resource reference (`resourceType` enum + `resourceId`), and a diff payload (`before` / `after` / `changedFields`). Survives the deletion of the subject and of the actor — that's the point. Rendered to end users as "Activity"; the storage entity stays **AuditEvent**.
_Not_ a **Notification** (user-facing message, may be deleted, has dedup); not a system log line (those are out-of-band, untyped).

**Actor**:
The **User** who caused an **AuditEvent**, or `null` when no user can be resolved. Distinct from the subject of the event — `actorUserId = subjectUserId` only for self-targeted auth events.

**DocumentExtraction**:
Structured data pulled from a user-uploaded file (image or PDF) by an AI provider. Has an **ExtractionKind** (`fuel_receipt`, `maintenance_invoice`, `insurance_policy`, `claim_document`), an optional `confidence` score, a `provider` tag (`gemini` today), and optionally a persisted row (kept for replay/audit when the extraction informs a created resource — e.g. `AttachmentExtraction` for maintenance). Output is a draft, never an authoritative record — the human always confirms via a form before persistence of the target resource.
_Not_ "OCR" — the provider reasons over the document, it does not just recognize characters. _Not_ "scan" — that is UI verb; persisted concept is **DocumentExtraction**.

**ExtractionKind**:
Discriminator for what shape the extracted JSON takes and which target resource the draft hydrates. One kind per use site. Adding a new use site (e.g. `registration_certificate`) means adding one entry to the registry, not a new service.

## Relationships

- A **Vehicle** has many **VehicleDocuments**, **MaintenanceRecords**, **Reminders**.
- The **AlertEngine** reads **VehicleDocument.findExpiring(withinDays)** to produce expiry **Notifications**. It does not query document tables directly.
- An **Attachment** is owned by either a **MaintenanceRecord** or a **VehicleDocument** (nullable FK pair).

## Flagged ambiguities

- "Policy" was used to mean **InsurancePolicy** (Prisma model) and any **VehicleDocument**. Resolved: **InsurancePolicy** is the storage row for `kind=insurance`; the domain term is **VehicleDocument**.
- "OCR" / "scan" / "extraction" were used interchangeably across `FuelLogsOCRService`, `AttachmentExtractionService`, `ClaimExtractionService`. Resolved: domain term is **DocumentExtraction**; "scan" is reserved for UI verbs only; "OCR" deprecated (Gemini reasons, doesn't just recognize).
