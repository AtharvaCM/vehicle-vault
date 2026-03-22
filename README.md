# Vehicle Vault

Vehicle Vault is a pnpm workspace monorepo for a vehicle maintenance tracking product. It keeps the frontend, backend, shared TypeScript contracts, workspace tooling, and product docs in one repo without Nx.

## Workspace layout

```text
vehicle-vault/
  apps/
    web/      # Vite + React + TypeScript
    api/      # NestJS API
  packages/
    shared/   # Shared enums, types, constants, Zod schemas
    config/   # Shared TypeScript, ESLint, and Prettier configs
  docs/       # Product and domain notes
```

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm catalog:import:all
pnpm build
pnpm dev
```

Run individual apps when needed:

```bash
pnpm dev:web
pnpm dev:api
```

## PostgreSQL and auth setup

The API now uses Prisma with PostgreSQL for users, vehicles, maintenance records, reminders, and attachment metadata. Authentication uses JWT access tokens, refresh-token rotation, and bcrypt password hashing.

Required backend environment variable:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=vehicle-vault-attachments
JWT_SECRET=vehicle-vault-dev-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=vehicle-vault-dev-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d
```

`FRONTEND_ORIGIN_PATTERN` is optional. Use it only when you need preview browser origins, such as dynamic Vercel preview URLs, alongside the stable allowlist in `FRONTEND_ORIGIN`.

Password reset is available through the public auth routes. In non-production environments, reset requests return a preview token directly because email delivery is not wired yet.

Common local database workflow:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm catalog:import:all
pnpm dev:api
```

## Fresh environment checklist

For a new local or hosted environment:

1. Create a Postgres database and set `DATABASE_URL` and `DIRECT_URL`.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`.
3. Set `JWT_SECRET`, `JWT_REFRESH_SECRET`, and the corresponding expiry values.
4. Set `FRONTEND_ORIGIN` to the stable browser origin.
5. Optionally set `FRONTEND_ORIGIN_PATTERN` if you need preview browser URLs.
6. Run:

```bash
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm catalog:import:all
pnpm build
```

The API creates the Supabase Storage bucket on startup if it does not already exist.

If you already have a local database from the pre-auth build, reset it or point `DATABASE_URL` at a fresh database before running the new migration. Vehicles now require a user owner, so older auth-less rows do not migrate cleanly without a reset.

Useful Prisma commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm catalog:import:all
pnpm db:studio
```

## Self-hosted API deploy

The public backend base URL for the frontend should be:

```bash
https://vehiclevault.middle-earth.in/api
```

For your Portainer-based home server deployment:

- preferred: publish the GHCR image via `.github/workflows/api-image.yml` and use `deploy/portainer/api-stack.ghcr.yml`
- fallback: use `apps/api/Dockerfile` plus `deploy/portainer/api-stack.yml` for host-path builds
- keep `DATABASE_URL` and `DIRECT_URL` pointed at the Supabase pooler connection
- set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` for attachment binaries
- set a strong production `JWT_SECRET`
- set a separate strong production `JWT_REFRESH_SECRET`
- optionally set `FRONTEND_ORIGIN_PATTERN` for preview browser URLs such as Vercel preview deployments

Recommended production env file reference:

- `apps/api/.env.production.example`

The API container runs `prisma migrate deploy` on startup before launching Nest, so checked-in schema changes are applied automatically.

If you use the GHCR path, make sure the published package `ghcr.io/atharvacm/vehicle-vault-api` is readable by your Portainer host. If GHCR marks it private initially, switch the package visibility to public in GitHub Packages before deploying the stack.

## Frontend deploy (Vercel)

For production, the web app should use:

```bash
VITE_API_BASE_URL=https://vehiclevault.middle-earth.in/api
```

Useful frontend env files:

- `apps/web/.env.example` for local development
- `apps/web/.env.production.example` for production/Vercel

Recommended Vercel project settings for this pnpm workspace:

- Root directory: repository root
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter @vehicle-vault/web build`
- Output directory: `apps/web/dist`

The current deployed frontend origin is:

```bash
https://vehicle-vault-eight.vercel.app
```

Set `FRONTEND_ORIGIN` in the API deployment to that browser origin. If you later attach a custom frontend domain, `FRONTEND_ORIGIN` also accepts a comma-separated allowlist so you can keep the Vercel URL and new custom domain live during the transition.

If you want preview deployments to work without editing CORS each time, set `FRONTEND_ORIGIN_PATTERN` in the API deployment to a regex that matches only your preview hostnames. A practical Vercel example is:

```bash
^https://vehicle-vault.*\.vercel\.app$
```

## Scripts

- `pnpm dev` runs shared package watch mode plus the web and api apps.
- `pnpm build` builds the workspace in dependency order.
- `pnpm lint` runs package lint scripts.
- `pnpm typecheck` runs TypeScript checks across the workspace.
- `pnpm format` checks Prettier formatting across the repo.
- `pnpm format:write` rewrites files using Prettier.
- `pnpm db:generate` generates the Prisma client for the API app.
- `pnpm db:migrate` creates or applies the local development migration flow.
- `pnpm db:deploy` applies checked-in Prisma migrations.
- `pnpm db:studio` opens Prisma Studio against the configured database.

## Notes

- Frontend routing is set up with TanStack Router.
- Frontend server state is prepared with TanStack Query.
- Tailwind CSS is configured in the web app.
- The API uses Prisma + PostgreSQL, while uploaded receipt files now use Supabase Storage with metadata kept in Postgres.
- Vehicle make/model/variant search is now backed by a Prisma catalog. The app ships with a curated India-first seed, plus generation-aware and year-aware offering support so the catalog can expand to more markets later without changing the core vehicle form flow.
- Approved India import sources now include Hyundai, Maruti Suzuki, Tata, Mahindra, Honda Cars, and Royal Enfield via `pnpm catalog:import:all`. Imports now stage source snapshots and review diffs first; publishing into the trusted catalog happens from the in-app catalog review surface.
- Auth supports email/password sign-in, refresh-token rotation, and password reset request/confirm flows. Email verification and OAuth are still deferred.
- Vehicles own the rest of the data model. Maintenance records, reminders, dashboard summary, and attachments are all scoped through the authenticated user's vehicles.
- Background jobs, OCR, and notification delivery are intentionally deferred.
