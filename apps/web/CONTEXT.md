# Web

React SPA for Vehicle Vault. Consumes the API over HTTP; owns presentation, forms, client-side query caching, and routing. Shares its domain vocabulary with [apps/api/CONTEXT.md](../api/CONTEXT.md) — use those terms, not synonyms.

## Stack

React 19 + TypeScript + Vite 6. TanStack Router (code-defined routes, not file-based) + TanStack Query 5. react-hook-form + Zod (schemas shared via `@vehicle-vault/shared`). Tailwind 3.4 + shadcn/ui (Radix, `style: radix-nova`). Recharts for charts, sonner for toasts, papaparse for CSV import, Vitest (jsdom) for unit tests, Playwright for e2e.

Only env var: `VITE_API_BASE_URL` (`src/lib/env/env.ts`). Throws in PROD build if unset; dev defaults to `http://localhost:3001/api`.

## Language

**Feature slice**:
A self-contained directory under `src/features/<name>/` with the subfolder convention `api/`, `hooks/`, `components/`, `pages/`, `schemas/`, `types/`, `utils/`. All new domain code goes inside a slice, not in shared dirs. Current slices: auth, dashboard, vehicles, maintenance, reminders, fuel-logs, loans, attachments, claims, analytics, vehicle-documents, vehicle-sharing, audit, notifications, admin, settings.

**ApiClient** (`src/lib/api/api-client.ts`):
The single fetch wrapper. Injects `Authorization: Bearer` via a module-level token resolver; on 401 performs one deduped refresh-and-retry, then calls `onUnauthorized`. Configured once by **AuthProvider** via `configureApiClient(...)` — a module singleton, not React context. Never call `fetch` directly.

**Endpoint registry** (`src/lib/api/endpoints.ts`):
Central `as const` map of every backend route the web app calls. Source of truth for the consumed API surface. Never hardcode a path in a feature.

**Query key factory** (`src/lib/query/query-keys.ts`):
Hierarchical `queryKeys.<domain>.<selector>(...)` factory; every key builds on `.all()`. Never inline query keys. (Known violation: the notifications feature uses inline `['notifications']` — treat as debt, not precedent.)

**Response envelope**:
`{success, data, meta?}` on success; `{success:false, error:{code,message,details?}}` on failure. `api/` functions unwrap `.data`; errors become `ApiError` (carries `status` + body); user-facing text via `getApiErrorMessage()`.

**Search state**:
URL search params validated by a `normalize*Search` function in the feature's `types/`, used as the route's `validateSearch`. Pages are controlled: they receive `searchState` + `onSearchStateChange` (navigate with `replace: true`; defaults stripped from the URL). Examples: `vehicle-list-search.ts`, `maintenance-list-search.ts`, `vehicle-detail-search.ts` (tab state).

**Query-state UI**:
The standard triad `LoadingState` / `EmptyState` / `ErrorState` from `src/components/shared/` for every query-backed view. Forms use `FormField`; mutation errors go to `appToast.error(getApiErrorMessage(e))`.

**AppShell**:
`components/layout/app-shell.tsx` → `app-layout` → `sidebar` + `topbar` + main outlet. Renders `EmailVerificationScreen` instead of the app when the user's email is unverified. Navigation config lives in `sidebar.tsx` (`appNavigation`, `adminNavigation`).

## Routing

Route tree assembled in `src/app/router/index.tsx`; one `*-route.tsx` file per route under `src/routes/`, barrel-exported from `routes/index.ts`. Pages are code-split via `createLazyPage` (`lazy-page.tsx`).

- Public: `/`, login, register, forgot/reset-password, verify-email, oauth-callback.
- `appRoute` (id `app`) guards everything else: `beforeLoad` redirects unauthenticated users to `/login`. Admin routes additionally check `auth.user?.role === 'admin'`.
- Data loading is entirely in-component via TanStack Query — no router `loader`s, no `errorComponent`/`notFoundComponent` (known gap). `defaultPreload: 'intent'`.

Adding a route: create `routes/x-route.tsx` → export from `routes/index.ts` → wire into the tree in `app/router/index.tsx`.

## Data layer conventions

- `api/*.ts` exports an async function hitting `apiClient` and usually a `*QueryOptions()` factory. Hooks are thin `useQuery(xQueryOptions())` / `useMutation` wrappers.
- Query client defaults: `staleTime` 60s, `gcTime` 5min, no refetch-on-focus, queries `retry: 1`, mutations `retry: 0`.
- Mutation `onSuccess`: invalidate the domain's `queryKeys.<domain>.all()` (+ dashboard where relevant) and call `invalidateAudit(queryClient)` for audited writes.
- Domain types and Zod schemas come from `@vehicle-vault/shared` — feature `types/` and `schemas/` mostly re-export. Don't duplicate.
- Blob downloads (service-history PDF, resale report, account export) go through `apiClient.getBlob` — a separate code path from JSON.

## Auth

`AuthProvider` (`features/auth/providers/auth-provider.tsx`) owns token lifecycle: localStorage persistence (`vehicle-vault.auth-session`), silent refresh, expiry timer. Session expiry / refresh failure hard-redirects via `window.location.replace('/login')`, bypassing the router.

## Testing

- Unit: Vitest + jsdom, specs colocated (`*.spec.ts(x)`), setup in `src/test/setup.ts` (jest-dom, RTL cleanup, fresh in-memory localStorage per test).
- E2E: Playwright under `tests/e2e/` — boots its own Vite server on 127.0.0.1:4307 proxying to a **live staging API** (`E2E_API_PROXY_TARGET`, default `https://vehiclevault.middle-earth.in`). Chromium-only, serial. Running e2e has real network dependencies.

## Known debt / ambiguities

- `notifications` feature breaks slice conventions (inline keys, no `api/` folder, inline type).
- Duplicate layout components: `app-header.tsx` / `app-sidebar.tsx` / `app-navigation.ts` are legacy; the active layout is `topbar.tsx` + `sidebar.tsx`.
- Duplicate util locations: `lib/utils.ts` vs `lib/utils/cn.ts`.
- Vehicle-catalog admin curation UI (import-run review/publish/archive) lives under the `settings` slice, not `vehicles` — non-obvious placement.
- No React error boundaries; errors surface only via `ErrorState` and toasts.
