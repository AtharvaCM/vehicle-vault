# Tech Stack

As deployed today (verified against the repo, 2026-08-13). Aspirational entries are marked _(future)_.

## Frontend

- Vite 6
- React 19
- TypeScript 5.8
- TanStack Router (code-defined routes)
- TanStack Query
- Tailwind CSS + shadcn/ui (Radix)
- react-hook-form + Zod (shared schemas)

### Why

- Fast dev server
- Minimal framework overhead
- Great DX
- Full control

---

## Backend

- NestJS 11
- TypeScript 5.8
- REST APIs (`{success, data}` envelope, Swagger at `/api/docs`)

### Why

- Scalable architecture
- Modular design
- Strong ecosystem

---

## Database

- PostgreSQL (Supabase, Supavisor pooler)
- Prisma 6
- RLS enabled deny-by-default (closes PostgREST exposure; app connects as `postgres`)

---

## Storage

- Supabase Storage (local-FS backend for CI/dev via `ATTACHMENT_STORAGE_BACKEND=local`)

Used for: receipt uploads, documents, claim/loan attachments.

---

## AI

- Google Gemini (`@google/generative-ai`) — document extraction (fuel receipts, maintenance invoices, insurance policies, claim docs, loan docs). Gated on `GEMINI_API_KEY`.

---

## Authentication

- JWT (access + refresh tokens), Google + GitHub OAuth, email verification via SMTP

---

## Background Jobs

- NestJS Scheduler (cron) — alert engine, daily at 06:00, disabled in dev
- BullMQ + Redis _(future, not installed)_

---

## Notifications

- The DB notification row is canonical; each channel is best-effort fan-out on top of it. Channels are registered through the `NOTIFICATION_CHANNELS` DI token (`notifications.module.ts`)
- Email via SMTP (nodemailer)
- Web push via VAPID (`web-push`), `PushSubscription` rows per browser; no-ops until `VAPID_*` is configured
- SMS _(future)_

---

## Error Reporting

- Sentry SDKs (`@sentry/node`, `@sentry/react`) reporting to **GlitchTip**, which speaks the Sentry protocol — the DSN decides the backend, the code does not care
- Entirely opt-in: no `SENTRY_DSN` / `VITE_SENTRY_DSN` means no client is constructed and every SDK call is a no-op, so local and CI runs report nothing
- API reports 5xx only, from `GlobalExceptionFilter`; 4xx are the client being told "no", not a fault
- Errors only — tracing and session replay are off. Replay would capture registration numbers, policy numbers, and document scans
- `sendDefaultPii: false` on both sides: request bodies and user identifiers are never attached automatically

---

## Hosting

- Frontend: Vercel
- Backend: Docker image on GHCR → Portainer stack behind nginx (`vehiclevault.middle-earth.in/api`); migrations run on container start
- Database: Supabase managed PostgreSQL

---

## Dev Tooling

- pnpm workspaces (monorepo)
- ESLint, Prettier
- Husky + commitlint (Conventional Commits, enforced)
- semantic-release (auto version + CHANGELOG on `main`)
- Vitest (unit), Playwright (web e2e smoke)
- GitHub Actions: quality, e2e-smoke, release, api-image, commitlint

---

## Architecture Style

- API-first
- Modular backend
- Client-side rendering frontend
- Stateless services

---

## Key Principles

- Keep it simple
- Avoid over-engineering
- Optimize for iteration speed
