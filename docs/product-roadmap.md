# Product Roadmap

Last updated: 2026-06-03

This roadmap is meant to track the actual state of the repository, not an aspirational feature list. If a slice is shipped in code, it should move to `Completed`. If it is only scaffolded or discussed, it should stay in `Next` or `Later`.

## Current Product State

Vehicle Vault is a feature-rich authenticated maintenance platform with:

- email/password authentication
- user-scoped vehicles, maintenance records, reminders, and attachments
- Prisma + PostgreSQL persistence
- cloud-backed attachment binaries via Supabase Storage
- dashboard summary aggregation
- Gemini 1.5 Flash-backed Receipt OCR
- Integrated Fuel Log tracking and cost analytics
- Automated Maintenance Alerts (Cron-based) for service, reminders, and insurance expiries
- Mandatory Email Verification for account security
- "Quick Fill" presets for common service/reminder tasks
- Specialized "Protection" dashboard for Insurance and Warranty tracking
- Vehicle loan tracking with amortization, prepayments, foreclosure, attachments, and Gemini-backed sanction-letter OCR
- regression coverage across unit, integration, and Playwright smoke flows

The product already supports the core ownership loop:

1. Register or log in
2. Create a vehicle
3. Log maintenance against that vehicle
4. Upload receipts/documents to maintenance records
5. Create reminders tied to the vehicle
6. Review everything from the dashboard and detail pages

## Completed

### Platform and Architecture

- Monorepo structure with `apps/web`, `apps/api`, `packages/shared`, `packages/config`, and `docs`
- Vite + React + TypeScript frontend with TanStack Router and TanStack Query
- NestJS backend with modular domain structure
- Shared enums, types, and Zod schemas in `packages/shared`
- Shared workspace tooling, linting, formatting, and TypeScript config

### Auth and Ownership

- User registration
- User login
- JWT access-token authentication
- Refresh-token rotation and session renewal
- Password reset request + reset flow with non-production token preview
- SMTP-backed password reset email delivery for configured environments
- Authenticated session bootstrap in the frontend
- Proactive frontend handling for expired or malformed JWT sessions
- Route protection in the frontend and backend
- Mandatory Email Verification flow with hard enforcement
- User ownership enforced through vehicles and inherited by maintenance, reminders, dashboard data, and attachments

### Vehicles

- Create vehicle
- List vehicles
- View vehicle detail
- Backend-owned make/model/variant catalog for vehicle entry, seeded for India and keyed by market code for future expansion
- Catalog internals now support model generations, year-aware variant offerings, and import-run tracking for future market expansion
- Approved India catalog ingestion now includes Hyundai, Maruti Suzuki, Tata, Mahindra, Honda Cars, Kia, Toyota, Renault, Volkswagen, Skoda, Royal Enfield, Bajaj, Hero, TVS, and Yamaha source snapshots through the shared import pipeline
- The approved India catalog now includes a broader set of still-common legacy generations across high-volume models and motorcycles, instead of only current flagship lineups
- Catalog aliases now map messy real-world labels like `i20 Sportz`, `Polo GT TSI`, `Old Swift ZXI`, and `FZ V3` back onto the canonical make/model/generation/variant rows used by the app
- Internal catalog review tooling now stages import snapshots, shows diffs against published source data, and requires an explicit publish step before trusted catalog rows are updated
- Catalog reviewers can now archive source variants missing from the latest snapshot as historical, instead of deleting them or leaving them unresolved in the diff
- Catalog reviewers can now attach provenance notes and manual year-range/current-status corrections to published source offerings, and those overrides persist across future imports
- Odometer history and service-trend visibility on vehicle detail pages
- Edit vehicle
- Delete vehicle with confirmation
- Bulk delete actions for vehicles list views
- Search and sort on the vehicles list

### Maintenance Records

- Create maintenance record for a vehicle
- List maintenance records for a vehicle
- Global maintenance overview with search, filter, and sort
- View maintenance record detail
- Edit maintenance record
- Delete maintenance record with confirmation
- Bulk delete actions for maintenance list views
- Filter and sort vehicle maintenance history

### Reminders

- Create reminder for a vehicle
- List reminders globally
- List reminders per vehicle
- View reminder detail
- Edit reminder
- Delete reminder with confirmation
- Mark reminder as completed
- Reminder status handling for `upcoming`, `due_today`, `overdue`, and `completed`
- Search, filter, and sort for reminder views
- Bulk complete and bulk delete actions for reminder list views

### Attachments / Receipts

- Upload one or more files to a maintenance record
- Persist attachment metadata in PostgreSQL
- Store uploaded files in Supabase Storage
- Attachment validation for size, extension, and binary file signature
- Attachment reconciliation to remove stale metadata when storage objects are missing
- List attachments for a maintenance record
- Maintenance-detail attachment summary, upload guidance, and clearer action feedback
- Open / download an attachment
- Delete attachment metadata and stored object with confirmation
- Gemini 1.5 Flash integration for automated receipt parsing (OCR)

### Fuel Tracking & Analytics

- Create fuel logs for a vehicle (odometer, quantity, price per unit)
- Automatic total cost calculation and currency formatting
- Premium "Registry Shell" layout for fuel log history
- Usage-aware analytics including average km/L and cost-per-km metrics

### Notifications

- Real-time in-app Notification Center in the topbar
- Automated maintenance alerts for upcoming and overdue reminders
- Configurable Cron-based alert delivery (MAINTENANCE_ALERT_CRON)
- Onboarding notifications for new vehicles
- Status-based badge system and "Mark all as read" functionality

### Dashboard and Product Cohesion

- Dashboard summary endpoint backed by real database data
- Dashboard cards for vehicles, maintenance, and reminder urgency
- Upcoming and overdue reminder sections
- Recent maintenance and recent vehicle sections
- Cross-linking between dashboard, vehicles, maintenance, reminders, and attachments

### Quality and Delivery

- Vitest coverage for core frontend and backend behavior
- Playwright smoke test for the main garage journey
- GitHub Actions CI for lint, typecheck, build, test, and E2E smoke
- Vercel frontend deployment
- Stable production Docker runtime (resolved dependency hoisting issues)
- GHCR-based API image publishing
- Self-hosted API deployment path for Portainer + nginx proxy
- Fresh-environment deployment checklist for database, storage, auth secrets, and build steps
- Preview-deployment friendly CORS support via optional frontend-origin regex matching

### Interaction Quality

- Success and error toast coverage across the core auth, vehicle, maintenance, reminder, and attachment mutation flows
- Unsaved-changes protection across core vehicle, maintenance, and reminder create/edit forms
- URL-backed search, filter, and sort state across vehicles, maintenance, and reminder list views
- "Quick Fill" presets for common maintenance (Oil, Brakes) and reminders (Insurance, Tax)

### Responsive and Accessibility

- Skip link for keyboard users and stronger focus treatment across shell navigation
- Mobile sheet navigation with account quick actions and close-on-select behavior
- More resilient dialog, sheet, select, and dropdown sizing on smaller screens
- Better small-screen action layout for forms and vehicle-detail tabs

### Smart Utility & AI Forecasts (Milestone 3)

- AI-driven maintenance forecasting based on usage trends (ADM)
- Usage-aware reminder notifications (predicted odometer alerts)
- Catalog-linked service intervals for factory-accurate suggestions
- Premium "Smart Suggestions" UI in the maintenance form with Quick Apply
- Global "Smart Feed" aggregation on the main dashboard
- Specialized Tyre Health Tracker with 4-wheel visualization

### Insurance & Warranty Management (Milestone 5)
- Store core insurance policy details (Provider, Policy #, Premium, Dates)
- Track manufacturer and extended warranty coverage (date and odometer based)
- Integrated "Protection" tab on vehicle detail pages with status indicators (Active/Expiring/Expired)
- Automated proactive alerts 7 days before insurance expiry via in-app notification and email
- Centralized insurance/warranty history and current status visibility

### Export and Portability

- User-scoped JSON account export from settings
- Export includes account details, vehicles, maintenance records, reminders, and attachments

## MVP Gaps Still Open

These are the main items that still prevent the product from being a more complete and stable MVP.

### Functional Gaps

- No major functional gaps remain inside the current MVP scope

### Production Hardening Gaps

- No admin tooling

### Production Hardening Shipped

- **Audit logging (v1):** `AuditEvent` table with typed `AuditResourceType` enum + uuid resource id (no FK — surviving the subject is the point), diff payload (`before`/`after`/`changedFields`) with per-resource PII redaction, denormalised `ownerUserId` for indexed self-service reads. `AuditService.track` is invoked inside the same `prisma.$transaction` as the mutation. Two read endpoints: `GET /audit/me` (filter by resourceType, action, actionPrefix, from/to; cursor-paginated) and `GET /vehicles/:vehicleId/audit` (vehicle + descendants). Emission wired across the full mutation surface — auth (account created, login success/failure, logout, OAuth link), vehicles, maintenance records, reminders (including completed), fuel logs (single + bulk), claims, vehicle documents (insurance + warranty), and attachments. Forever retention with anonymise-on-account-deletion. Design recorded in ADR-0004.
- **Audit UI (v1):** Read-side surfaces for the audit log. Per-vehicle **Activity** tab on the vehicle detail page (`GET /vehicles/:vehicleId/audit`) and a **Settings → Activity** page (`GET /audit/me`, resource-type filter). Cursor-paginated infinite feed with expandable rows showing the `before`/`after` diff per changed field. Verified end-to-end against a live backend.
- **Audit coverage safety net (dev/CI):** Prisma `$transaction` override that flags any mutation whose transaction emitted no matching `AuditEvent`, enforcing the ADR-0004 in-transaction-write contract. Active only when `NODE_ENV !== 'production'`; token-rotation `user.update` and catalog-import transactions are exempt to avoid false positives.
- **OAuth/social auth (Google + GitHub):** Passport-based strategies on the API; `GET /auth/oauth/{provider}` redirects to the provider, callback exchanges the code, links or creates the local user, and rebounds to a frontend OAuth callback page that hydrates the session. Verified-email matches auto-link existing password accounts. `passwordHash` is now nullable so OAuth-only users can sign in without a credential. Providers are environment-gated — buttons disappear when client IDs are unset.

### Milestone 10: Service Schedule Catalog (Complete)

Goal: Stop asking users to invent every reminder from scratch — surface a generic recommended service schedule per vehicle and let them apply selected items as real reminders with one click.

- **Static catalog:** `apps/api/src/modules/reminders/service-schedule-catalog.ts` defines ten generic items (engine oil, tyre rotation, brake inspection, coolant flush, air filter, 12 V battery check, EV high-voltage battery check, PUC, insurance, motorcycle chain lube) with `intervalKm` / `intervalMonths`, `appliesToFuel`, `appliesToVehicle`. `filterCatalogForVehicle(fuelType, vehicleType)` returns the applicable subset so EV owners never see oil-change suggestions and motorcycle-only items don't leak into car suggestions.
- **API:** New `ServiceScheduleService` exposes `getSuggestions` (computes proposed `dueOdometer` from `vehicle.odometer + intervalKm`, proposed `dueDate` from today + `intervalMonths`, and flags `alreadyScheduled` for items already present as active reminders matched by title or by a `[catalog:slug]` marker in notes) and `applySuggestions` (bulk-creates reminders inside one `prisma.$transaction`, emits per-reminder audit events, rejects unknown / non-applicable slugs).
- **Endpoints (under existing `RemindersController`):**
  - `GET /vehicles/:vehicleId/service-schedule/suggestions` → `ServiceScheduleSuggestion[]`.
  - `POST /vehicles/:vehicleId/service-schedule/apply` body `{ slugs: string[] }` → `{ created: string[] }`.
- **Web:** `ServiceSchedulePanel` on the per-vehicle reminders page renders the suggestions list with checkbox selection, badges for already-scheduled items, interval + projected-next preview, and an "Add N reminders" button. Mutation invalidates `reminders.byVehicle`, `reminders.list`, and `reminders.scheduleSuggestions`. Shown both when reminders exist and on the empty state so brand-new vehicles get a one-click bootstrap.
- **Tests:** `service-schedule.service.spec.ts` covers fuel-type filtering (EV vs petrol), dueOdometer math, `alreadyScheduled` flagging from existing reminders, the bulk-apply happy path with audit emission, and rejection of unknown slugs.

### Milestone 9: Usage-Aware Reminder Projection (Complete)

Goal: Turn km-based reminders into time-aware ones by projecting when the vehicle will actually hit `dueOdometer`, using its own fuel-log driving cadence.

- **Cadence engine:** `apps/api/src/modules/reminders/usage-projection.ts` — pure helpers `computeUsageCadence(samples, asOf, windowDays)` and `projectDueDate(currentOdo, dueOdo, cadence, asOf)`. Cadence = km/day over a trailing 180-day fuel-log window, with confidence tiers (high ≥ 6 samples / 90 days, medium ≥ 3 / 30, low otherwise). Returns null when there is not enough recent data, so projection is silently absent rather than misleading.
- **API integration:** `RemindersService` now batches fuel-log loads per vehicle (`loadCadenceMap` for list paths, `loadCadenceForVehicle` for single reads — no N+1) and folds `usageProjection` into every reminder response when `dueOdometer` is set and the reminder isn't completed. Projection block carries `projectedDueDate`, `kmPerDay`, `confidence`, `sampleCount`, `sampleDays`.
- **Shared schema:** `ReminderSchema` gains an optional `UsageProjectionSchema` field; type `UsageProjection` exported alongside `Reminder` so web consumes it without extra typing.
- **Web:** Reminder card shows a "Projected ~Aug 12" pill next to the due-date row when the projection is available, with a tooltip explaining the km/day rate, sample window, and confidence tier.
- **Tests:** `usage-projection.spec.ts` covers empty / non-advancing / out-of-window / low / medium / high confidence cases and the projection math; existing `reminders.service.spec.ts` extended with a `fuelLog.findMany` mock so the cadence loader is exercised in the integration path.

### Milestone 8: Resale Report (Complete)

Goal: Give owners a buyer-facing PDF that discloses outstanding loan, insurance status, pending service items, and a document checklist — without leaking owner-only cost analytics.

- **API:** `GET /vehicles/:vehicleId/resale-report.pdf?askingPrice=…` in `ReportsController`. New `ResaleReportService` loads vehicle, maintenance, fuel-log (km only), policies, claim count, vehicle loans + prepayments, and open reminders, then reuses `summarize()` from `vehicle-loans/amortization.ts` to disclose per-loan outstanding balance and remaining tenure.
- **PDF sections:** Cover (vehicle + owner-since + distance + optional asking price) → Loan disclosure (active loans flagged amber with outstanding ₹ and EMI; closed loans noted with NOC availability) → Insurance (active policy + valid-until + lifetime claim count) → Open service items (overdue/due-today/upcoming reminders) → Document checklist (RC, active insurance, PUC, loan NOC — auto-checked from data) → Maintenance log (date, category, workshop, odometer; no costs).
- **Privacy:** Owner-only fields suppressed — no cost-per-km, no fuel/maintenance totals, no insurer-paid amounts. Footer disclaimer states data is self-reported.
- **Shared helpers:** Extracted `pdf-utils.ts` (`inr`, `intFmt`, `fmtDate`, `decimalToNumber`, `drawRow`, `drawKeyValue`) so `ServiceHistoryService` and `ResaleReportService` share formatting.
- **Web:** "Download Resale Report (PDF)" entry in vehicle detail dropdown, next to the existing service-history download. Optional asking-price captured via prompt and forwarded as query param.

### Milestone 7: Vehicle Loans (Complete)

Goal: Reflect financed purchases in true cost of ownership instead of assuming cash buyers.

- **Domain model:** `VehicleLoan` (principal, annual rate, tenure, cached EMI, currency, status, closedAt, notes) + `LoanPrepayment` (date, amount, notes). `LoanStatus` enum (active/closed). New `AuditResourceType` values (`vehicle_loan`, `loan_prepayment`) with `accountNumber` redaction. `Attachment` extended with `vehicleLoanId` as a 5th polymorphic owner and the `attachment_owner_exclusive` CHECK constraint widened to 5-of-5. Three Prisma migrations applied to Supabase.
- **Amortization engine:** Server-side EMI computation (`P*r*(1+r)^n / ((1+r)^n - 1)`, zero-rate linear fallback) and month-by-month schedule that honors prepayments (fixed-EMI / shorter-tenure strategy) and foreclosure (truncates schedule at `closedAt` with outstanding treated as lump-sum paid). Powers `summarize()` (totals, monthsRemaining, outstanding, interestPaidToDate, prepaidToDate, endDate) and `accruedInRange()` (per-window interest + principal for analytics).
- **API:** `VehicleLoansModule` with CRUD (`GET/POST/PATCH/DELETE /vehicle-loans`), per-vehicle list (`/vehicle-loans/vehicle/:id`), amortization series (`GET /:id/schedule`), prepayment add/remove (`POST/DELETE /:id/prepayments[/:prepaymentId]`), and foreclosure (`POST /:id/foreclose`). Audit-logged inside each transaction.
- **Document OCR:** `LoanDocumentExtractionSpec` (Gemini, registered via `onModuleInit`) with `POST /vehicle-loans/scan` + `/scan/status`. Extracts lender, account number, principal, annual rate, tenure (months), start date, EMI, currency, notes from sanction letters / agreements. Robust `normalize()` clamps rate to 0–100, validates positive integers, normalizes bare-date strings to ISO.
- **Attachments:** `AttachmentsService.listByVehicleLoan` + `uploadLoanAttachments`. `getStoredAttachmentById` OR-matches loan and maintenance owners so the existing `DELETE /attachments/:id` endpoint works for both. Routes: `GET/POST /vehicle-loans/:loanId/attachments`.
- **Analytics integration:** `AnalyticsService.getCostSplit`, `getCostTrend`, and `getTco` load loans + prepayments and credit loan interest into the per-window buckets and lifetime TCO. Response types gain `loanInterest`, `loanPrincipal`, `loanPrincipalPaid`, `loanOutstanding`. Dashboard summary gains a `loans` block (active count, monthly EMI, outstanding, interest paid, prepaid, next EMI date).
- **Web (Loans feature):** Global `/loans` page with summary stats and per-loan cards. `LoanDetailDialog` includes an amortization chart (Recharts `ComposedChart`, stacked principal + interest + prepayment area + balance line on a secondary axis), prepayment add/remove, foreclose flow, and document upload/list/remove. Add Loan dialog auto-shows a "Scan document" button when `/scan/status` reports available, then prefills the form via key-remount with the extracted draft. Edit-loan dialog reuses the same form.
- **Web (vehicle-centric surfaces):** "Loans" tab on vehicle detail (`VehicleLoansPanel`) for per-vehicle loan management. Sidebar gains a Loans entry (Coins icon). Dashboard overview gains a "Vehicle loans" card surfacing active EMI, outstanding, lifetime interest, and next EMI date when loans exist. Cost-split donut and ownership-trend chart render a new "Loan interest" series; TCO card conditionally renders "Loan interest paid" and "Loan outstanding".

### Milestone 6: Financial Insights & Reporting (Complete)

Goal: Provide deep visibility into ownership costs and facilitate resale value.

- **Visual Analytics:** Fuel vs Maintenance vs Insurance cost split — donut chart on dashboard (shipped, slice 1). Pro-rated insurance premium across overlap; insurer-paid claim amounts netted out of the maintenance bucket.
- **Vehicle purchase metadata:** `purchaseDate`, `purchasePrice`, `purchaseOdometer` captured on the vehicle form (shipped). Backbone for TCO and ownership-trend slices.
- **Ownership Trend:** Line charts for monthly fuel/maintenance/insurance/total spend and a derived cost-per-km series, served from `/analytics/cost-trend` (shipped, slice 2). Km derived from fuel-log odometer deltas attributed to the month of the later reading.
- **Total Cost of Ownership (TCO):** Lifetime card on vehicle detail page sourced from `/analytics/tco/:vehicleId` (shipped, slice 4). Sums maintenance + fuel + insurance, subtracts insurer-reimbursed claims, adds purchase price when available, and derives ₹/km and ₹/month against ownership window. Falls back to fuel-log odometer range when purchase odometer is missing.
- **PDF Service History:** Generate a professional Service Book report for records or resale (shipped, slice 3). Endpoint `GET /vehicles/:vehicleId/service-history.pdf` builds a pdfkit document covering vehicle metadata, lifetime cost summary, full maintenance log, insurance policies, and claim history. The vehicle detail dropdown offers a one-click download.

## Later Roadmap

These are intentionally deferred so the product does not sprawl too early.

### Product Enhancements

- Shared vehicle access for families or teams

### Smart Features

- AI-assisted service entry suggestions
- Usage-aware reminder suggestions
- Vehicle-specific service schedule intelligence

### Ecosystem and Scale

- Insurance or registration integrations
- Service center integrations
- Resale history/report generation
- Public API access

## Guardrails for Future Planning

When updating this roadmap:

- move shipped work to `Completed` immediately after it lands
- do not list placeholders as completed
- keep `Recommended Next Milestones` short and ordered
- treat OCR, AI, notifications, and integrations as explicitly deferred until the core ownership workflow is solid
- prefer features that strengthen the ownership timeline over flashy additions

## Product Direction

The product should keep converging on one outcome:

> Vehicle Vault becomes the single source of truth for vehicle ownership, service history, due work, and supporting documents.
