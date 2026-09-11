# Product direction, September 2026

_Written 2026-09-11 from the prod database (read-only), the repo at v1.24.3, and three code audits (API surface, web journeys, intelligence layer). `product-roadmap.md` stays the feature-state ledger; this doc answers one question: what should the next eight weeks be about?_

## Bottom line

Vehicle Vault is feature-complete far beyond its usage. Since GA it has shipped 24 minor releases, a 1,720-variant India catalog, seven extraction kinds, loans, sharing, tyres, accessories, and a ten-kind alert engine. It has never had an external user. The 26 accounts in prod are 25 test-pattern addresses and one real person, and the Playwright suite registers users against the production API by default.

The constraint is not features. It is that nobody can find the product, the first session asks too much, the phone experience is a desktop app squeezed down, and the reminder promise at the heart of the Daily Commuter persona is broken: a reminder with only a due date never raises an alert.

Recommended direction: **fix the promise, make the commuter loop work on a phone, give the product a front door, and instrument everything.** Ship intelligence only where it is one query away from data already collected. Defer catalog breadth, new capture domains, and benchmarks until ten weekly-active people exist to see them.

## Evidence

### Usage (prod Supabase, 2026-09-11)

| Fact                                                                                                          | Value                               |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Accounts                                                                                                      | 26, all created March 2026          |
| Accounts whose email matches a test pattern (e2e, playwright, example.com, plus-tag)                          | 25                                  |
| Real accounts                                                                                                 | 1                                   |
| Actors behind every audited write since May                                                                   | 1                                   |
| Vehicles created in Jul, Aug, Sep                                                                             | 0                                   |
| Shared members, invites, push subscriptions, compliance docs, warranties, service baselines, tyre inspections | 0 each                              |
| Extraction runs                                                                                               | 5, mean confidence 0.94, 0 failures |

There has been no launch. The prod database has doubled as the e2e target: `apps/web/playwright.config.ts` defaults `E2E_API_PROXY_TARGET` to the production API, and three of the four specs call `registerAndSignIn`.

### The reminder promise is broken

`MaintenanceAlertService` queries reminders with `dueOdometer: { not: null }` and has no `dueDate` branch at all. A reminder created with only a date, which is what every renewal-style reminder and every month-only service-schedule item produces, is shown on the dashboard queue and nowhere else. No email, no push. Persona 1's single need is "reminders that just work".

Two more engine gaps sit next to it. Every `raise()` targets `vehicle.userId`, the legacy owner column, so editors and viewers on a shared vehicle receive nothing; sharing was built for exactly those people. And `MaintenanceRecord.nextDueDate` / `nextDueOdometer`, which the invoice extractor fills in, are written and never read.

### The 9 September alert burst

The first cron after v1.24.0 raised 21 `tyre-uninspected` and 9 `service-baseline-unknown` notifications. Only one vehicle has tyres on file; the tyre prompt fires for any vehicle with none tracked once it is old enough (`runTyreInspectionPrompt`, reason `untracked`). Fine for an engaged user, noise for a dormant one. `EmailChannel.deliver` has no `emailVerified` check and the template has no unsubscribe link, so it went to unverified addresses. There is no notification-preference model; every one of ten alert kinds fans out to both channels, and the Settings "Preferences" page is a placeholder. That the recipients were test accounts is luck, not design.

### Instrumentation

The web app has no product analytics. The only client-side reporting is the GlitchTip error DSN. Nothing records signup, vehicle-created, first-log, or notification-opened. Everything in this memo was derived from row counts because that is the only signal that exists.

### Front door and hardening

`/` redirects to `/login`; there is no landing page, so a stranger cannot learn what the product does. Public auth endpoints have no rate limiting. There is no React error boundary and no route-level not-found or error component, so one render exception is a white screen. The catalog import-review card renders for every user on Settings, with copy telling them to run a pnpm command.

### Catalog: stored, not used

`VehicleCatalogVariantSpec` carries about 60 fields per variant: engine, claimed mileage, tyre size, EV battery and charge rates, safety. The only consumer is the specs card. Service cadence uses a generic ten-row table; per-variant `ServiceInterval` rows exist for two models via a seed script. Tyre size is user-typed. Real km/L is never computed although fuel logs have litres and odometer and the catalog has the claimed figure; the vehicle page still reads "Soon: We'll calculate your average km/L". Five weeks of summer velocity went into this dataset and no feature reads it.

## Diagnosis

1. **Acquisition is zero** because there is nothing to find: no landing page, no indexable content, no share surface.
2. **Activation is expensive.** Register, verify by email, land on login again, then a vehicle form with eight required fields including variant through cascading catalog pickers, then two more manual entries before any due date exists. Persona 1 is "not very technical" and lives on a phone.
3. **The daily loop is desk-shaped.** Fuel is three taps deep inside the fifth of eleven tabs. One input in the whole app opens the camera. No odometer-only update, no bottom navigation, no offline shell, no install prompt.
4. **Nudges are unreliable and uncontrolled.** Date reminders never fire, co-members never hear, and what does fire cannot be tuned or unsubscribed.
5. **Retrieval lags capture.** Ten tabs, no global search, no timeline, no cross-vehicle filter. The product thesis is "single source of truth for the ownership timeline" and there is no timeline entity.

## Direction

> Eight weeks to ten weekly-active people who each get one useful nudge they did not have to configure.

Three pillars, in priority order:

1. **Fix the promise, then hygiene and visibility** (weeks 1 to 2). Date-based reminder alerts. Alerts to every member. Verified-only email with unsubscribe and per-kind preferences. Rate limiting. Error boundary. Telemetry. A landing page. Stop pointing e2e at prod.
2. **Phone-first commuter loop** (weeks 2 to 6). Onboarding down to registration number, make, model, year, fuel, odometer, with variant optional. Camera-first capture on every receipt input. Three-field quick log. Odometer-only update. Bottom navigation, scrollable tabs, sheet dialogs, precaching service worker, install prompt.
3. **One-query intelligence** (interleaved, small). Real versus claimed km/L. Documents keep their file and Renew prefills. A per-vehicle data-health score from fields that already exist.

## Plan

### Now (weeks 1 to 2, all small)

| #   | Item                                                                                                                                                                                                                                                                                                        | Why now                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Add a `dueDate` branch to the reminder check in `MaintenanceAlertService`, mirroring the `dueOdometer` block; templates and dedup keys already exist                                                                                                                                                        | The core promise; one file                                |
| 2   | Raise alerts to every `VehicleMember` instead of `vehicle.userId`; members are already in the engine's `include`                                                                                                                                                                                            | Sharing persona receives nothing today; one file          |
| 3   | Gate `EmailChannel` on `emailVerified`; add an unsubscribe link; add a `NotificationPreference` row per user with per-kind toggles and check it in `NotifyService.dispatch`; suppress the "untracked" and "baseline unknown" prompts for accounts with no write in 60 days and vehicles younger than 7 days | Stops unsolicited mail; prerequisite for any real user    |
| 4   | Flip the Playwright default target to `127.0.0.1:3001` and purge the 25 test accounts from prod (your call; irreversible)                                                                                                                                                                                   | Prod stops being the test bed and the numbers become real |
| 5   | Telemetry: Clarity script (the connector already exists) plus an append-only `ProductEvent` table for signup, verified, vehicle_created, first_log, notification_opened                                                                                                                                     | Without this the next eight weeks cannot be judged        |
| 6   | `@nestjs/throttler` on register, login, forgot-password, invite accept                                                                                                                                                                                                                                      | Required before any public push                           |
| 7   | Landing page at `/` for logged-out visitors: what it is, three screenshots, one CTA                                                                                                                                                                                                                         | A front door                                              |
| 8   | React error boundary plus route `errorComponent` and `notFoundComponent`; gate the catalog review card on `allowedCatalogSources`; hide write controls from viewer-role members on maintenance, fuel, protection, accessories, tyres                                                                        | Polish a first real user would trip on                    |
| 9   | Soften the verification wall to 7 days of unverified use, now that mail is gated on verification anyway                                                                                                                                                                                                     | Removes an email round-trip from first value              |

### Next (weeks 2 to 6)

| #   | Item                                                                                                                                                                                                                                           | Effort |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 10  | Onboarding trim: variant optional with model-level catalog link fallback, skip the re-login after verify, land on the new vehicle with a two-field "insurance expiry and PUC expiry" prompt                                                    | M      |
| 11  | Quick capture: `capture="environment"` on job-card and document inputs; a three-field quick log (date, odometer, cost, optional photo) from the dashboard; odometer-only update on the health card; fuel launcher beside Log service           | M      |
| 12  | Mobile shell: bottom nav, horizontally scrollable tab strip, sheet-style dialogs under `md`, precache service worker, `beforeinstallprompt` CTA, iOS Home-Screen hint in the push `unsupported` state                                          | M      |
| 13  | Real versus claimed km/L on the overview and fuel tab, from fuel-log deltas against `spec.mileageCombined`                                                                                                                                     | S      |
| 14  | Documents keep their file: attachment routes for insurance and warranty (owner columns and CHECK already exist), an owner column for `ComplianceDocument`, "Renew" prefilled from the expiring record, a phone-sized "show this document" view | M      |
| 15  | Honour captured fields: create or refresh a Reminder from `nextDue*` on confirm; alert on warranty `endOdometer`                                                                                                                               | S      |
| 16  | Dashboard shows what the bell knows: extend `DashboardAttentionKind` with tyre, baseline, and accessory using the same verdict services; add tyre edit, delete, and inspection-history UI for the endpoints already declared                   | M      |
| 17  | Vehicle data-health score on the health card from existing fields: catalog link, purchase price, baseline coverage, insurance and PUC presence, days since odometer, tyres tracked                                                             | S to M |

### Later (only after ten weekly-active users)

- **Public catalog pages as the acquisition wedge.** One indexable page per model and variant with specs, the resolved service schedule, and a cost-of-ownership calculator, ending in "Track this vehicle". The first thing that makes the catalog investment pay and the only organic traffic source on the table. Large.
- **Unified ownership timeline.** A read model unioning service, fuel, documents, claims, loans, accessories, tyres, and ownership transfers by domain date, cursor-paginated, with the attention queue as its future tail. This is the product thesis and it does not exist. Medium to large.
- **90-day spend forecast** from the attention queue times last cost per category, premium, and EMI. Medium.
- **Catalog admin surface**: port `catalog:audit` to an admin coverage endpoint, an admin PATCH for `allowedCatalogSources`, manual re-link for vehicles the fuzzy linker missed. Medium.
- **Household grouping** so one invite covers every family vehicle. Large; wait for demand.
- **Anonymised per-generation benchmarks** with consent and cron-materialised medians. Highest differentiation, needs volume that does not exist.
- **OEM service intervals** for the top 30 models. The highest-leverage catalog work, once cadence is visible to users.

## Stop doing for now

- Catalog breadth and parser curation. 1,720 variants serve one card. Add a consumer before adding rows.
- New alert kinds before preferences exist. Each one is another unsolicited email.
- New capture domains. Retrieval, not capture, is the gap.
- Desktop-first dialogs and tabs. Design every new surface at 375 px first.
- Running e2e against prod.

## How we will know

| Metric                             | Today      | Target at week 8 |
| ---------------------------------- | ---------- | ---------------- |
| External users                     | 0          | 25 signed up     |
| Weekly-active users (any write)    | 1          | 10               |
| Signup to first log within 7 days  | unmeasured | 40 percent       |
| Date reminders that raise an alert | 0 percent  | 100 percent      |
| Notification opened within 48 h    | unmeasured | 30 percent       |
| Emails to unverified addresses     | possible   | 0                |

Decision point at week 4: if the landing page and trimmed onboarding have not produced five activated external users, the problem is distribution, not product, and weeks 5 to 8 go to the public catalog pages instead of items 12 to 17.

## Doc debt found on the way

- `product-context.md` and `apps/api/CONTEXT.md` say five extraction kinds; there are seven (`warranty_document`, `compliance_document`).
- `apps/api/.env.example` omits the SMTP variables `app.config.ts` reads.
- Two service-interval tables disagree (resolver versus reminder catalog: oil 7.5k versus 10k km, brakes 30k versus 20k); flagged in CONTEXT.md, still open.
- `product-context.md` describes a March cohort of users; there was none.

## Appendix: audit highlights

**API surface.** 142 route handlers across 25 controllers, essentially all consumed by the web. Under-exposure is inside routes: point-in-time document coverage (`/documents/active?date=`) never called; audit filters for action and date range unused by the Activity page; seven web endpoint keys declared with no UI (tyre update, remove, inspections; notification delete and unread count; fuel-log and loan detail). `AttachmentExtraction` rows are persisted for maintenance invoices only, so six of seven kinds have no replay row despite ADR-0005. `User.allowedCatalogSources` has no writer anywhere. Playwright covers four journeys on desktop Chrome; fuel, loans, claims, sharing, tyres, accessories, notifications, extraction, analytics, PDFs, admin, OAuth, and compliance docs are uncovered.

**Web journeys.** First run is about four screens, twelve fields, and one email round-trip before any due date exists. Only the fuel "Scan Receipt" input opens the camera. The reminder form has no lead time, channel, or mute. Cross-vehicle pages have no vehicle filter. No global search; cmdk is installed and used only inside the catalog picker. Eleven tabs sit in an unscrollable strip on the vehicle page. `sw.js` is push-only and registered only when push is enabled. Settings hardcode INR and en-IN; no profile edit, password change, or account deletion.

**Intelligence layer.** Forecasting is a single first-to-last km/day rate, with a second cadence estimator for reminders. `InsurancePolicy.insuredValue` is extracted and never analysed, although IDV per policy year is an insurer-supplied depreciation curve. Extraction is synchronous inside the request, with no file-hash dedupe, no correction capture, and no per-user quota. Zero code for Vahan, insurer, FASTag, or OBD integrations; no ICS export.
