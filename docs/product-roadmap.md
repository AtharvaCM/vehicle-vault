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
- List attachments for a maintenance record
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

## MVP Gaps Still Open

These are the main items that still prevent the product from being a more complete and stable MVP.

### Functional Gaps

- Export feature is still not implemented in the product UI or API in a meaningful way
- No bulk actions across vehicles, reminders, or maintenance history
- No global maintenance overview filters beyond the per-vehicle history
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

- No unsaved-changes guard on forms
- Mobile/tablet polish is still behind desktop polish
- Search/filter state is local to pages and not persisted in the URL

## Recommended Next Milestones

These are ordered by product leverage, not by technical novelty.

### Milestone 1: Complete the CRUD and Flow Polish

Goal: remove the remaining friction from day-to-day use.

- Add success/error toast coverage across remaining mutations
- Add unsaved-changes protection to create/edit forms
- Tighten attachment management UX on maintenance detail pages
- Add a global maintenance overview route with search/filter/sort

### Milestone 2: Finish the Missing MVP Capability

Goal: close the biggest stated MVP gap.

- Implement export for user-owned data
- Decide on the first export shape:
  - CSV for vehicles + maintenance
  - JSON full export for user-owned records
- Surface export from settings and/or vehicle detail
- Keep export user-scoped and authenticated

### Milestone 3: Responsive and Accessibility Pass

Goal: make the app feel production-grade outside desktop demos.

- Improve mobile sidebar and topbar behavior
- Tighten form layouts on smaller screens
- Improve keyboard navigation and focus states
- Review contrast and hit targets
- Ensure dialogs, sheets, and menus behave accessibly

### Milestone 4: Session and Security Hardening

Goal: move auth from MVP-safe to more production-safe.

- Add refresh-token strategy or other session renewal approach
- Add password reset request + reset flow
- Improve token expiry handling in the frontend
- Review file-upload validation and abuse protection

### Milestone 5: Storage and Ops Hardening

Goal: remove the remaining temporary infrastructure choices.

- Move uploaded files from local disk to cloud storage
- Add safer attachment cleanup and reconciliation behavior
- Improve deployment docs for fresh environments
- Add preview-environment friendliness where needed

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
