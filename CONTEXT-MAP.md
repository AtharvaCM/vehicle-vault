# Context Map

## Contexts

- [API](./apps/api/CONTEXT.md) — NestJS backend. Owns vehicle data, documents, maintenance, notifications, auth.
- [Web](./apps/web/CONTEXT.md) — Frontend. Consumes API; owns presentation, forms, query caching.

## Relationships

- **Web → API**: HTTP. Shared types via `@vehicle-vault/shared` (Zod schemas).
