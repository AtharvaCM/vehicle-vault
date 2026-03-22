# Product Roadmap

Last updated: 2026-03-22

This roadmap is meant to track the actual state of the repository, not an aspirational feature list. If a slice is shipped in code, it should move to `Completed`. If it is only scaffolded or discussed, it should stay in `Next` or `Later`.

## Current Product State

Vehicle Vault is now a working authenticated MVP with:

- email/password authentication
- user-scoped vehicles, maintenance records, reminders, and attachments
- Prisma + PostgreSQL persistence
- cloud-backed attachment binaries via Supabase Storage
- dashboard summary aggregation
- receipt/document upload support
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
- Authenticated session bootstrap in the frontend
- Proactive frontend handling for expired or malformed JWT sessions
- Route protection in the frontend and backend
- User ownership enforced through vehicles and inherited by maintenance, reminders, dashboard data, and attachments

### Vehicles

- Create vehicle
- List vehicles
- View vehicle detail
- Backend-owned make/model/variant catalog for vehicle entry, seeded for India and keyed by market code for future expansion
- Catalog internals now support model generations, year-aware variant offerings, and import-run tracking for future market expansion
- Approved India catalog ingestion now includes Hyundai, Maruti Suzuki, Tata, Mahindra, Honda Cars, and Royal Enfield source snapshots through the shared import pipeline
- Internal catalog review tooling now stages import snapshots, shows diffs against published source data, and requires an explicit publish step before trusted catalog rows are updated
- Catalog reviewers can now archive source variants missing from the latest snapshot as historical, instead of deleting them or leaving them unresolved in the diff
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
- GHCR-based API image publishing
- Self-hosted API deployment path for Portainer + nginx proxy
- Fresh-environment deployment checklist for database, storage, auth secrets, and build steps
- Preview-deployment friendly CORS support via optional frontend-origin regex matching

### Interaction Quality

- Success and error toast coverage across the core auth, vehicle, maintenance, reminder, and attachment mutation flows
- Unsaved-changes protection across core vehicle, maintenance, and reminder create/edit forms
- URL-backed search, filter, and sort state across vehicles, maintenance, and reminder list views

### Responsive and Accessibility

- Skip link for keyboard users and stronger focus treatment across shell navigation
- Mobile sheet navigation with account quick actions and close-on-select behavior
- More resilient dialog, sheet, select, and dropdown sizing on smaller screens
- Better small-screen action layout for forms and vehicle-detail tabs

### Export and Portability

- User-scoped JSON account export from settings
- Export includes account details, vehicles, maintenance records, reminders, and attachments

## MVP Gaps Still Open

These are the main items that still prevent the product from being a more complete and stable MVP.

### Functional Gaps

- No major functional gaps remain inside the current MVP scope

### Production Hardening Gaps

- No email delivery for password reset requests yet
- No email verification flow
- No OAuth/social auth
- No background jobs or reminder delivery
- No audit logging or admin tooling

## Recommended Next Milestones

These are ordered by product leverage, not by technical novelty.

### Milestone 1: Catalog Coverage and Ingestion

Goal: turn the vehicle catalog from a curated seed into a maintainable regional data asset.

- Expand India coverage so the seeded catalog covers the long-tail brands and legacy variants more comprehensively
- Add catalog import tooling that can ingest and diff data from approved sources instead of relying only on handwritten seed updates
- Expand approved India source coverage beyond Hyundai, Maruti Suzuki, Tata, Mahindra, Honda Cars, and Royal Enfield
- Add a richer internal workflow for source provenance notes and manual year-range corrections where the source data is ambiguous
- Keep market onboarding data-driven so adding markets beyond India means seeding/importing new rows, not rewriting the vehicle-entry flow

### Milestone 2: Production Hardening

Goal: close the highest-value operational gaps without expanding product scope too early.

- Add real email delivery for password reset requests
- Add email verification for new accounts
- Decide on reminder delivery architecture before adding background jobs or notifications

## Later Roadmap

These are intentionally deferred so the product does not sprawl too early.

### Product Enhancements

- Service presets and templates
- Reminder presets for common India-specific ownership tasks
- Shared vehicle access for families or teams

### Smart Features

- OCR invoice parsing
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
