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

## Relationships

- A **Vehicle** has many **VehicleDocuments**, **MaintenanceRecords**, **Reminders**.
- The **AlertEngine** reads **VehicleDocument.findExpiring(withinDays)** to produce expiry **Notifications**. It does not query document tables directly.
- An **Attachment** is owned by either a **MaintenanceRecord** or a **VehicleDocument** (nullable FK pair).

## Flagged ambiguities

- "Policy" was used to mean **InsurancePolicy** (Prisma model) and any **VehicleDocument**. Resolved: **InsurancePolicy** is the storage row for `kind=insurance`; the domain term is **VehicleDocument**.
