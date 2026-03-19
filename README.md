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
pnpm build
pnpm dev
```

Run individual apps when needed:

```bash
pnpm dev:web
pnpm dev:api
```

## PostgreSQL setup

The API now uses Prisma with PostgreSQL for vehicles, maintenance records, reminders, and attachment metadata.

Required backend environment variable:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public
```

Common local database workflow:

```bash
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

Useful Prisma commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:studio
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
- The API uses Prisma + PostgreSQL, while uploaded receipt files still stay on local disk for now.
- Authentication, background jobs, cloud storage, and notification delivery are intentionally deferred.
