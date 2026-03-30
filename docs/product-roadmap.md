# Product Roadmap

Last updated: 2026-03-29

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
- Automated Maintenance Alerts (Cron-based)
- Mandatory Email Verification for account security
- "Quick Fill" presets for common service/reminder tasks
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

### Export and Portability

- User-scoped JSON account export from settings
- Export includes account details, vehicles, maintenance records, reminders, and attachments

## MVP Gaps Still Open

These are the main items that still prevent the product from being a more complete and stable MVP.

### Functional Gaps

- No major functional gaps remain inside the current MVP scope

### Production Hardening Gaps

- No OAuth/social auth
- No audit logging or admin tooling

### Milestone 5: Documentation & Coverage (Insurance & Warranty) (Next)

Goal: provide a specialized location for tracking vehicle protection and coverage.

- **Insurance Management:** Store policy numbers, providers, premiums, and validity.
- **Warranty Tracking:** Monitor manufacturer and extended warranty coverage (date and odometer based).
- **Document Vault:** Centralized view for all vehicle-level documentation (Insurance copies, RC, Warranty cards).
- **Auto-Reminders:** Link insurance expiry and warranty end dates to the notification system.

### Milestone 6: Financial Insights & Reporting

Goal: Provide deep visibility into ownership costs and facilitate resale value.

- **Visual Analytics:** Fuel vs Maintenance vs Insurance cost split (Pie/Donut charts)
- **Ownership Trend:** Line charts for cost-per-month and cost-per-km over time
- **PDF Service History:** Generate a professional Service Book report for records or resale
- **Total Cost of Ownership (TCO):** Aggregated metrics across years for entire vehicle life

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
