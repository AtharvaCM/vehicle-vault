# Web

React SPA for Vehicle Vault. Consumes the API over HTTP; owns presentation, forms, client-side query caching, and routing. Shares its domain vocabulary with [apps/api/CONTEXT.md](../api/CONTEXT.md) — use those terms, not synonyms.

## Stack

React 19 + TypeScript + Vite 6. TanStack Router (code-defined routes, not file-based) + TanStack Query 5. react-hook-form + Zod (schemas shared via `@vehicle-vault/shared`). Tailwind 3.4 (with `@tailwindcss/container-queries`) + shadcn/ui (Radix, `style: radix-nova`). Recharts for charts, sonner for toasts, papaparse for CSV import, Vitest (jsdom) for unit tests, Playwright for e2e.

Only env var: `VITE_API_BASE_URL` (`src/lib/env/env.ts`). Throws in PROD build if unset; dev defaults to `http://localhost:3001/api`.

## Language

**Feature slice**:
A self-contained directory under `src/features/<name>/` with the subfolder convention `api/`, `hooks/`, `components/`, `pages/`, `schemas/`, `types/`, `utils/`. All new domain code goes inside a slice, not in shared dirs. Current slices: auth, dashboard, vehicles, maintenance, reminders, fuel-logs, loans, accessories, attachments, claims, analytics, vehicle-documents, vehicle-sharing, audit, notifications, admin, settings.

**ApiClient** (`src/lib/api/api-client.ts`):
The single fetch wrapper. Injects `Authorization: Bearer` via a module-level token resolver; on 401 performs one deduped refresh-and-retry, then calls `onUnauthorized`. Configured once by **AuthProvider** via `configureApiClient(...)` — a module singleton, not React context. Never call `fetch` directly.

**Endpoint registry** (`src/lib/api/endpoints.ts`):
Central `as const` map of every backend route the web app calls. Source of truth for the consumed API surface. Never hardcode a path in a feature.

**Query key factory** (`src/lib/query/query-keys.ts`):
Hierarchical `queryKeys.<domain>.<selector>(...)` factory; every key builds on `.all()`. Never inline query keys. (Known violation: the notifications feature uses inline `['notifications']` — treat as debt, not precedent.)

**Response envelope**:
`{success, data, meta?}` on success; `{success:false, error:{code,message,details?}}` on failure. `api/` functions unwrap `.data`; errors become `ApiError` (carries `status` + body); user-facing text via `getApiErrorMessage()`.

**Search state**:
URL search params validated by a `normalize*Search` function in the feature's `types/`, used as the route's `validateSearch`. Pages are controlled: they receive `searchState` + `onSearchStateChange` (navigate with `replace: true`; defaults stripped from the URL). Examples: `vehicle-list-search.ts`, `maintenance-list-search.ts`, `vehicle-detail-search.ts` (tab state), `dashboard-search.ts` (attention-queue focus filter; the route re-normalises `useSearch()` output because TanStack's search is non-strict and leaks unknown raw params).

**Query-state UI**:
The standard triad `LoadingState` / `EmptyState` / `ErrorState` from `src/components/shared/` for every query-backed view. Forms use `FormField`; mutation errors go to `appToast.error(getApiErrorMessage(e))`.

**Vehicle naming**:
`describeVehicleModel(vehicle)` builds the "make model variant" line everywhere one is shown. The variant is optional on a vehicle, so the helper drops it rather than leaving a separator with nothing after it; `VehicleSpecsCard` says so outright, because specs are published per variant and its lookup never runs without one.

**Vehicle access** (`features/vehicles/context/vehicle-access.tsx`):
The signed-in user's role on the vehicle on screen, provided from `vehicle.currentUserRole` by every vehicle-scoped page: `VehicleDetailPage` (where the members lookup is a fallback), the vehicle maintenance and reminder list pages, the maintenance-record and reminder detail and edit pages, the maintenance and reminder create pages, and `VehicleEditPage`. A page that only learns its vehicle from a record it is loading gets the role from `useVehicle(record.vehicleId)`, which waits on an empty id. Anything nested reads `useVehicleAccess()`: `canEdit` (owner or editor) gates every create/edit/delete/import/scan control, `isOwner` gates deleting the vehicle, loans and member management. Viewers get the same lists, details and downloads with the controls removed, not disabled, and a "View only" badge on the vehicle header explains why; a form a viewer cannot submit is replaced by `ViewOnlyNotice` rather than left to 403 on save. Outside the provider nothing is hidden (`canEdit` defaults to true) — the API is the enforcement, this only avoids offering a button that will 403. Cards that take optional `onEdit`/`onDelete`/`onSelectionChange` handlers drop their controls when the handler is omitted; cards that always render a delete read the context themselves.

**Draft confirmation** (`features/maintenance/pages/maintenance-record-edit-page.tsx`):
A record the upload-first flow made (`status: draft`, `source: ocr`, hydrated by "Apply to Draft") is an extraction nobody has agreed to, and everything in the API that answers what was done or spent reads confirmed rows only. Its edit page is where a human agrees, so for a draft the page is titled "Confirm Maintenance Record", the form's button reads **Confirm Record**, and the save sends `status: 'confirmed'` beside the reviewed fields — one PATCH that saves the edit and confirms, which is what fires `first_maintenance_logged` and the next-due reminder in the API's `updateRecord`. Saving a draft always confirms it; there is no "save but leave it a draft" path, because nothing outside this page marks a record as a draft and one left behind reads as logged while counting nowhere. A confirmed record keeps the plain "Save Changes" wording, and a viewer gets `ViewOnlyNotice` either way. Applying an extraction writes the record back to draft, so a re-scanned record is offered for confirmation again.

**Notification preferences** (`/settings/preferences`, `features/settings/pages/notification-preferences-page.tsx`):
Email and push switches per alert kind, grouped by `ALERT_KIND_GROUPS` with copy from `ALERT_KIND_COPY` (a `Record<AlertKind, …>`, so a kind added to the shared `ALERT_KINDS` will not compile without a label). A switch saves on its own, optimistically, through `useUpdateNotificationPreferences` (sends only that kind; rolls back and shows an inline error on failure; a response is not written over a newer save still in flight). The "Every alert" row is an action button, not a switch: with some kinds on and some off, a switch reading off would claim everything was off. The per-device push subscription (`PushDeviceSetting`) lives on this page, not in the bell, which links here. The unsubscribe link in alert mail reads here as every email switch off. `components/ui/switch.tsx` is a dependency-free `role="switch"` button.

**AppShell**:
`components/layout/app-shell.tsx` → `app-layout` → `sidebar` + `topbar` + main outlet + `bottom-nav`. Navigation config lives in `sidebar.tsx` (`appNavigation`, `adminNavigation`). Which navigation shows depends on width: the sidebar from `xl`; the topbar's menu button and chip row from `md` to `xl`; below `md`, a fixed bottom bar with Dashboard, Vehicles, Service and Reminders, plus More. More and the menu button open the same sheet (`mobile-nav-sheet.tsx`). Below `md`, `<main>` is padded by the bar's height plus `env(safe-area-inset-bottom)` (the viewport meta sets `viewport-fit=cover`), so the bar never covers the last row. A tab strip that can outgrow the screen scrolls sideways and uses `useActiveTabInView`, which scrolls the list itself rather than the page.

**Page width** (page grids, `PageHeader`, record, reminder and fuel log cards):
From `xl` the sidebar opens and the vehicle page's panels split into two columns, so a panel can be narrower at 1280px than full width on a tablet. A grid whose content should truncate rather than widen it gives every track a zero minimum (`grid-cols-1`, `xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]`): an `auto` minimum grows the column, and the page, to the widest line that cannot wrap. `MaintenanceRecordCard`, `ReminderCard` and `FuelLogCard` sit in both kinds of column, so they lay out by their own width rather than the screen's: each is an `@container`, and its figures move beside the text once that leaves the text about 200px. That is `@xl` (36rem) for a record or reminder, and `@2xl` (42rem) for a fill, whose three figures and menu are wider. `PageHeader` keeps its title at least 20rem wide beside the actions; where that doesn't fit, the actions wrap to a row below it.

**Garage card footer** (`features/dashboard/components/vehicle-health-card.tsx`):
The dashboard's garage grid adds a column at `sm` and again at `xl`, so its cards are narrowest just past each: about 275px inside the padding at 1280, less than on a phone. `VehicleHealthCard` is an `@container` for its footer: under 22rem the odometer reading gets a row of its own and the labelled actions take the row below. Phones (icons only) and viewers (the menu only) keep one row, and both rows wrap rather than spill.

**Vehicle setup prompt** (`features/vehicles/components/vehicle-setup-prompt.tsx`):
The insurance/PUC expiry card at the top of a vehicle's Overview tab. Shows while `vehicle.setupPromptDismissedAt` is null, the documents query has loaded, and a kind it asks for is missing: insurance, and PUC unless the vehicle is electric (see the API's **PUC exemption**); `canEdit` gates it, so a viewer never sees it. Saving posts one document per filled date (the expiry alone — the insurer and number come later) and then dismisses; "Not now" dismisses on its own. A failed save keeps the dates on screen instead of dismissing.

**Responsive dialog** (`components/ui/responsive-dialog.ts`):
Below `md` every `Dialog` and `AlertDialog` is a bottom sheet, with no per-dialog opt-in. The sheet is a layer of `max-md:` classes on top of the centred modal's own classes, so from `md` up nothing changes, including each dialog's own `max-w-*`/`max-h-*` overrides. The sheet rests on `--keyboard-inset` and is capped at `--visible-height`. `useVisibleViewport` sets both from the visual viewport, so the sheet sits above an on-screen keyboard. `DialogFooter` stays pinned flush to the bottom of the sheet, so the primary action is in reach while typing. A dialog that puts its primary button somewhere else loses that, though the button still scrolls within reach.

**Installable app** (`src/sw.ts`, `features/pwa/`):
`src/sw.ts` is built to `/sw.js` by vite-plugin-pwa (`injectManifest`). It keeps the push handlers and precaches the build's files with content revisions; stale entries are dropped on activate, so a deploy cannot leave an old shell behind. Navigations go to the network first and fall back to the precached `index.html` only when offline; `/api` is never answered from the worker. It registers from `main.tsx` in production only, loaded lazily so the dev server never requests it. `captureInstallPrompt()` runs before the first render and holds `beforeinstallprompt`. `InstallAppCard` offers installation on the dashboard once there is a vehicle, and "Not now" stays dismissed on that device. On iOS in Safari, the push setting explains the Home Screen route. `AuthProvider` separates a session the server refused (a 400/401/403 from refresh, which signs out) from a server it could not reach (network error or 5xx), which keeps the stored session and retries. Otherwise opening the app offline would sign the user out.

**Checkpoint view** (`/vehicles/$vehicleId/documents/$kind/$documentId`, `features/vehicle-documents/pages/document-checkpoint-page.tsx`):
One document the way it gets shown when someone asks for it. It's a fixed full-screen overlay over the app's chrome, so the auth guard still applies. It shows, in order: a plain VALID / runs-out-soon / EXPIRED banner, the number at `text-4xl`, the issuer, the validity, then the files. Images display in place through `useAttachmentObjectUrl`, which creates and revokes the object URL in the same effect so it survives StrictMode; PDFs open in a new tab. The vehicle's registration sits under the title. Every document card has a **Show** link to it for every role, including viewers, making it two taps from the vehicle: Protection, then Show.

**Fill in from photo** (`features/attachments/components/fill-from-photo-dialog.tsx`):
A confirmed record's image or PDF offers "Fill in from photo" on the record page, not the edit page: writing to the record under its form would reset what is being typed there. It shows to a known owner or editor only, and only while `GET /attachments/extraction/status` says the extractor is configured. Opening the dialog is the request to read the file; a file read before is not read again until "Read the photo again". The dialog lists what the API says the fill adds (`GET /attachments/:id/fill`), which is only what the record leaves blank, and "Fill in" writes exactly that; the rule is not restated here. On the edit page a confirmed record's document review keeps what was read but not "Apply to Draft", which would overwrite the record and turn it back into a draft.

**Verification grace**:
An unverified account gets the whole app for a week, then a wall. The API decides the deadline and sends it as `user.emailVerificationDueAt` (null when there is nothing to verify: verified, or an OAuth account with no address); `getVerificationStatus()` (`features/auth/lib/verification-status.ts`) only compares it with the clock. Inside the week `AppLayout` shows `EmailVerificationBanner` (days left, resend, dismissed until the next local day per user); after it, `EmailVerificationScreen` replaces the app. A session from an API that sends no deadline at all keeps the wall. The verification link usually opens in a new tab: there `/verify-email` refreshes the signed-in user (`refreshUser()` on the auth context) and returns to `/dashboard` rather than to login, and the original tab re-reads the account when it comes back into view. Both surfaces resend through `useResendVerification`, which holds a 60-second cooldown on top of the API's `mail` rate limit.

## Routing

Route tree assembled in `src/app/router/index.tsx`; one `*-route.tsx` file per route under `src/routes/`, barrel-exported from `routes/index.ts`. Pages are code-split via `createLazyPage` (`lazy-page.tsx`).

- Public: `/`, login, register, forgot/reset-password, verify-email, oauth-callback.
- `appRoute` (id `app`) guards everything else: `beforeLoad` redirects unauthenticated users to `/login`. Admin routes additionally check `auth.user?.role === 'admin'`.
- Data loading is entirely in-component via TanStack Query — no router `loader`s. `defaultErrorComponent` and `defaultNotFoundComponent` are set on the router (see Testing → Errors and unknown addresses). `defaultPreload: 'intent'`.

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
- Product analytics: `lib/monitoring/init-clarity.ts` loads Microsoft Clarity only when `VITE_CLARITY_PROJECT_ID` is set — otherwise nothing is injected and nothing is sent. Clarity records sessions, so `AppLayout`'s root carries `data-clarity-mask="True"`: everything signed-in (registration and policy numbers, scanned documents, the account email on the verification wall) is masked, and only the public funnel stays visible. Set the Clarity project's own masking mode to Strict too. Event counts themselves are server-side (`ProductEvent` in the API); the bell opens notifications through `POST /notifications/:id/open` so they are counted.
- Landing page: `/` renders `features/landing/pages/landing-page.tsx` for guests and redirects signed-in users to `/dashboard` (`routes/index-route.tsx`). Its three screenshots (`features/landing/assets/*.webp`) are real captures of the app against the demo seed (`pnpm --filter @vehicle-vault/api run prisma:seed:demo`) — the triage queue, a draft maintenance record carrying a completed extraction, and the Daily Hatch's Protection tab from Warranty down — at 1180 px wide, 2x, encoded to WebP at most 1400 px wide. They go stale when those screens change; recapture rather than edit them. The page's copy must stay true of the shipped product (it describes in-app heads-ups, not email).
- Errors and unknown addresses: the router's `defaultErrorComponent` (`components/errors/route-error.tsx`) replaces a page that throws with a recovery screen, reports it through `Sentry.captureException` (a no-op without a DSN), and resets on navigation — rendering inside the app shell for signed-in routes, so the sidebar still works. `AppErrorBoundary` around the providers catches what throws outside any route and resets on back/forward. `defaultNotFoundComponent` (`not-found-screen.tsx`) renders at the root for any unknown address and picks its own frame: in the shell when signed in, on the public auth layout otherwise.
- E2E: Playwright under `tests/e2e/` — boots its own Vite server on 127.0.0.1:4307 proxying to a **local API** (`E2E_API_PROXY_TARGET`, default `http://127.0.0.1:3001`), and writes to the database directly to mark new users verified or to age an account past its verification week (`DATABASE_URL`, falling back to `apps/api/.env`). Both are checked when the config loads (`tests/e2e/helpers/api-target.ts`, `database-target.ts`): the production API needs `E2E_ALLOW_PRODUCTION_API=1` and any non-local database needs `E2E_ALLOW_REMOTE_DATABASE=1`, otherwise the run aborts before anything boots. The database guard is not production-specific because this repo is public and naming the production database would publish it. Chromium-only. `helpers/` is excluded from Playwright's test match, which lets the helpers carry Vitest unit specs.

## Known debt / ambiguities

- `notifications` feature breaks slice conventions (inline keys, no `api/` folder, inline type).
- Duplicate layout components: `app-header.tsx` / `app-sidebar.tsx` / `app-navigation.ts` are legacy; the active layout is `topbar.tsx` + `sidebar.tsx`.
- Duplicate util locations: `lib/utils.ts` vs `lib/utils/cn.ts`.
- Vehicle-catalog admin curation UI (import-run review/publish/archive) lives under the `settings` slice, not `vehicles` — non-obvious placement.
