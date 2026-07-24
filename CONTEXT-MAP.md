# Context Map

## Contexts

- [API](./apps/api/CONTEXT.md) — NestJS backend. Owns vehicle data, documents, maintenance, loans, claims, sharing/RBAC, notifications, audit, extraction, catalog, auth.
- [Web](./apps/web/CONTEXT.md) — React SPA. Consumes API; owns presentation, routing, forms, query caching.

## Shared

- `packages/shared` (`@vehicle-vault/shared`) — the API↔Web contract: Zod schemas, enums, constants, types. Both apps import domain types from here; never duplicate them locally.
- `packages/config` (`@vehicle-vault/config`) — shared TS/ESLint/Prettier configs only.

## Relationships

- **Web → API**: HTTP, `{success, data}` envelope, JWT bearer + refresh. Full consumed surface listed in `apps/web/src/lib/api/endpoints.ts`.

## Product & decisions

- [Product context](./docs/product-context.md) — what the product is, personas, shipped timeline, which docs to trust.
- ADRs: `apps/api/docs/adr/` (0001–0005). No root or web ADR dirs yet.
