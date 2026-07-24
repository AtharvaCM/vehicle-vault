# Product Context

The product/domain briefing for anyone (human or AI agent) working on Vehicle Vault. Read this before steering roadmap, triaging issues, or scoping features. For code architecture, read `CONTEXT-MAP.md` → per-app `CONTEXT.md`.

_Last updated: 2026-07-24._

## What the product is

**Vehicle Vault** is an India-focused vehicle ownership platform: a single source of truth for everything attached to a car or two-wheeler — maintenance history, fuel, insurance/warranty documents, loans, claims, reminders — with intelligence layered on top (odometer forecasting, alert engine, AI document extraction, cost analytics, resale reports).

The problem it solves (see `problem-statement.md`): vehicle data in India is fragmented across paper, WhatsApp, and service centers; tracking is manual; there are no smart reminders and no ownership timeline. India-specific realities are first-class: registration-number onboarding, insurance/PUC workflows, multi-vehicle households, bikes and cars together.

Live at `https://vehicle-vault-eight.vercel.app` (web) + `https://vehiclevault.middle-earth.in/api` (API).

## Personas (see `user-personas-and-stories.md`)

1. **Daily Commuter** — one vehicle, non-technical, wants reminders that just work.
2. **Enthusiast** — multi-vehicle, tracks costs/parts/mods in detail.
3. **Family Vehicle Manager** — manages vehicles for others; the demand signal behind Shared Vehicle Access (roles: owner/editor/viewer).

## What has shipped (evidence: CHANGELOG.md)

- **1.0.0 (2026-05-30)** — GA with the full core: auth (email+password, Google/GitHub OAuth, email verification), vehicles + India make/model/variant **catalog** (CarWale-scraped, staged import review), maintenance records with line items, reminders, attachments (Supabase Storage) with **Gemini document extraction**, fuel tracking, odometer forecasting + alert engine (cron → email), audit trail, insurance & warranty as unified **VehicleDocuments**, claims, TCO/cost-trend/cost-split analytics, PDF service history, CSV import, Swagger.
- **1.1.x** — admin user directory; extraction fixes.
- **1.2.0–1.3.0 (early June)** — **Vehicle Loans**: amortization, prepayments, foreclosure, OCR, analytics integration.
- **1.4.0–1.5.0 (June)** — **Shared Vehicle Access** (M12): members, roles, invites, ownership transfer.
- **1.6.0–1.13.1 (mid-June → July)** — almost entirely **catalog/spec data curation**: parser tightening, spec backfill, motorcycle coverage, pseudo-variant cleanup.

**Strategic signal:** the last ~5 weeks of velocity went into India catalog data quality/breadth, not user-facing features. The catalog is the largest ongoing investment and a de-facto moat — yet it barely appears in the product docs. Treat it as a first-class product surface when planning.

## Which docs to trust

| Doc | Status |
|---|---|
| `docs/product-roadmap.md` | **Authoritative** for feature state (self-tracks repo reality), but its "Later" section is unpruned — lists items (AI service suggestions, usage-aware reminders, shared access, resale report) that already shipped and are marked Complete elsewhere in the same file. |
| `docs/problem-statement.md`, `docs/user-personas-and-stories.md` | Evergreen, trustworthy. |
| `docs/mvp-definition.md` | **Historical only.** Its non-goals (OCR, AI recommendations, advanced analytics) all shipped. Do not use for scoping. |
| `docs/tech-stack.md` | **Stale in specifics** — says Bun (actually pnpm), Resend/Postmark (actually SMTP), Railway/Render (actually Vercel + GHCR/Portainer), BullMQ/Redis planned (actually NestJS cron only), multi-option storage (actually Supabase Storage). Trust README + `.github/workflows` + `CONTEXT.md`s instead. |
| `CHANGELOG.md` | Ground truth for what shipped and when (semantic-release generated). |
| `apps/api/CONTEXT.md` | Canonical domain glossary. Use its terms; "Policy", "OCR", "scan" are deprecated vocabulary. |

## How work flows

- Issues/PRDs = GitHub issues on `AtharvaCM/vehicle-vault` (`docs/agents/issue-tracker.md`); triage via labels `needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix` (`docs/agents/triage-labels.md`).
- Conventional Commits enforced (commitlint + husky); semantic-release on `main` auto-versions and writes CHANGELOG.
- Deploy: web → Vercel on push; API → GHCR image → Portainer stack (migrations run on container start).

## Open product directions (from roadmap "Later", deduped against shipped reality)

Still genuinely open: service-center/ecosystem integrations, native mobile, richer social/community features, deeper resale-market intelligence, SMS notification channel. (Registration/PUC/road-tax document kinds and the web-push channel shipped 2026-07.)

## Known product-doc debt

- Prune `product-roadmap.md` "Later" section of shipped items.
- Archive or rewrite `mvp-definition.md`; correct `tech-stack.md`.
