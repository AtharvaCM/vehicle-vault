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
pnpm build
pnpm dev
```

Run individual apps when needed:

```bash
pnpm dev:web
pnpm dev:api
```

## Scripts

- `pnpm dev` runs shared package watch mode plus the web and api apps.
- `pnpm build` builds the workspace in dependency order.
- `pnpm lint` runs package lint scripts.
- `pnpm typecheck` runs TypeScript checks across the workspace.
- `pnpm format` checks Prettier formatting across the repo.
- `pnpm format:write` rewrites files using Prettier.

## Notes

- Frontend routing is set up with TanStack Router.
- Frontend server state is prepared with TanStack Query.
- Tailwind CSS is configured in the web app.
- The API is intentionally database-free for now so Prisma/Postgres can be added later.
