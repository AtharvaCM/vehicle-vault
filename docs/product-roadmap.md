# Product Roadmap

Last updated: 2026-03-21

This roadmap is meant to track the actual state of the repository, not an aspirational feature list. If a slice is shipped in code, it should move to `Completed`. If it is only scaffolded or discussed, it should stay in `Next` or `Later`.

## Current Product State

Vehicle Vault is now a working authenticated MVP with:

- email/password authentication
- user-scoped vehicles, maintenance records, reminders, and attachments
- Prisma + PostgreSQL persistence
- dashboard summary aggregation
- local receipt/document upload support
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
- Authenticated session bootstrap in the frontend
- Proactive frontend handling for expired or malformed JWT sessions
- Route protection in the frontend and backend
- User ownership enforced through vehicles and inherited by maintenance, reminders, dashboard data, and attachments

### Vehicles

- Create vehicle
- List vehicles
- View vehicle detail
- Edit vehicle
- Delete vehicle with confirmation
- Search and sort on the vehicles list

### Maintenance Records

- Create maintenance record for a vehicle
- List maintenance records for a vehicle
- Global maintenance overview with search, filter, and sort
- View maintenance record detail
- Edit maintenance record
- Delete maintenance record with confirmation
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

### Attachments / Receipts

- Upload one or more files to a maintenance record
- Persist attachment metadata in PostgreSQL
- Store uploaded files locally on disk for now
- Attachment validation for size, extension, and binary file signature
- List attachments for a maintenance record
- Maintenance-detail attachment summary, upload guidance, and clearer action feedback
- Open / download an attachment
- Delete attachment metadata and local file with confirmation

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

### Interaction Quality

- Success and error toast coverage across the core auth, vehicle, maintenance, reminder, and attachment mutation flows
- Unsaved-changes protection across core vehicle, maintenance, and reminder create/edit forms

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

- No bulk actions across vehicles, reminders, or maintenance history
- No vehicle odometer history or trend view

### Production Hardening Gaps

- No refresh-token flow
- No password reset flow
- No email verification flow
- No OAuth/social auth
- No cloud object storage for uploaded files
- No background jobs or reminder delivery
- No audit logging or admin tooling

### UX Gaps

- Search/filter state is local to pages and not persisted in the URL

## Recommended Next Milestones

These are ordered by product leverage, not by technical novelty.

### Milestone 1: Session and Security Hardening

Goal: move auth from MVP-safe to more production-safe.

- Add refresh-token strategy or other session renewal approach
- Add password reset request + reset flow

### Milestone 2: Storage and Ops Hardening

Goal: remove the remaining temporary infrastructure choices.

- Move uploaded files from local disk to cloud storage
- Add safer attachment cleanup and reconciliation behavior
- Improve deployment docs for fresh environments
- Add preview-environment friendliness where needed

### Milestone 3: Workflow Depth

Goal: improve day-to-day productivity without diluting the ownership model.

- Persist search and filter state in the URL where it helps
- Add bulk actions where they are operationally useful
- Add odometer history and service-trend visibility

## Later Roadmap

These are intentionally deferred so the product does not sprawl too early.

### Product Enhancements

- Service presets and templates
- Reminder presets for common India-specific ownership tasks
- Odometer history and better service insights
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
