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
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm dev
```

Run individual apps when needed:

```bash
pnpm dev:web
pnpm dev:api
```

## PostgreSQL and auth setup

The API now uses Prisma with PostgreSQL for users, vehicles, maintenance records, reminders, and attachment metadata. Authentication uses JWT access tokens and bcrypt password hashing.

Required backend environment variable:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public
JWT_SECRET=vehicle-vault-dev-secret
JWT_EXPIRES_IN=7d
```

Common local database workflow:

```bash
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

If you already have a local database from the pre-auth build, reset it or point `DATABASE_URL` at a fresh database before running the new migration. Vehicles now require a user owner, so older auth-less rows do not migrate cleanly without a reset.

Useful Prisma commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:studio
```

## Self-hosted API deploy

The public backend base URL for the frontend should be:

```bash
https://api.vehiclevault.middle-earth.in/api
```

For your Portainer-based home server deployment:

- preferred: publish the GHCR image via `.github/workflows/api-image.yml` and use `deploy/portainer/api-stack.ghcr.yml`
- fallback: use `apps/api/Dockerfile` plus `deploy/portainer/api-stack.yml` for host-path builds
- persist uploads with the `vehicle_vault_uploads` volume
- keep `DATABASE_URL` and `DIRECT_URL` pointed at the Supabase pooler connection
- set a strong production `JWT_SECRET`

Recommended production env file reference:

- `apps/api/.env.production.example`

The API container runs `prisma migrate deploy` on startup before launching Nest, so checked-in schema changes are applied automatically.

If you use the GHCR path, make sure the published package `ghcr.io/atharvacm/vehicle-vault-api` is readable by your Portainer host. If GHCR marks it private initially, switch the package visibility to public in GitHub Packages before deploying the stack.

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
- The API uses Prisma + PostgreSQL, while uploaded receipt files still stay on local disk for now.
- Auth is email/password plus JWT access token only for MVP. There is no refresh-token, password-reset, email-verification, or OAuth flow yet.
- Vehicles own the rest of the data model. Maintenance records, reminders, dashboard summary, and attachments are all scoped through the authenticated user's vehicles.
- Background jobs, cloud storage, OCR, and notification delivery are intentionally deferred.
