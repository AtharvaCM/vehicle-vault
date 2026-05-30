# DocumentExtraction unified behind a registry

**Status**: accepted

Three Gemini-backed OCR services grew up independently — `FuelLogsOCRService`, `AttachmentExtractionService`, `ClaimExtractionService`. Each duplicated client init, schema-constrained JSON config, base64 `inlineData` plumbing, error mapping, and normalize helpers. Adding insurance-policy extraction would have made it four. The naming had also drifted: "OCR", "scan", and "extraction" all meant the same thing, none of them accurately ("OCR" is wrong — Gemini reasons, it does not just recognize characters).

We introduce a single **DocumentExtraction** concept (see CONTEXT.md) and a dedicated `modules/extraction/` module that owns provider plumbing only. Per-kind specs (schema + prompt + normalize) stay co-located with the consumer module that owns the target resource — `vehicle-documents/extractions/insurance-policy.extraction.ts` is registered with the engine via a DI multi-provider, mirroring how `VehicleDocumentAdapter` already works. The engine is domain-agnostic; it knows about providers and `ExtractionKind` slugs, not about insurance fields or maintenance line items.

Provider access goes through one `ExtractionProvider` interface, bound to `GeminiExtractionProvider` today. A future swap to Claude / OpenAI / a local model is a binding change, not a sweep through every consumer.

Every extraction returns a uniform `ExtractionResult<T>` envelope — `{ provider, extractedAt, confidence?, data }`. Confidence stays optional inside the envelope because not every provider returns it reliably, but `provider` and `extractedAt` are always present so any extraction is debuggable / auditable without consumer-side branching.

## Rejected alternatives

**Polymorphic `DocumentExtraction` table with `targetType`/`targetId` FK.** Would have unified persistence across all kinds. Rejected as premature — only `AttachmentExtraction` (maintenance) needs the replay / review surface today; fuel / insurance / claim flows pre-fill a form and forget. The polymorphic FK is the kind of speculative abstraction this codebase explicitly avoids. Persistence stays opt-in per-kind; `AttachmentExtraction` remains as the maintenance-specific table.

**Centralized schemas in `extraction/kinds/`.** Single grep target, but inverts dependency direction — `extraction/` would import `MaintenanceCategory`, `VehicleDocumentKind`, claim types, and every future domain concept. Co-located registration keeps the engine free of domain leakage and matches the existing adapter pattern.

**Per-kind provider override** (kind → provider mapping). YAGNI — all four kinds run on Gemini today. The single-provider interface is small enough to refactor if a real per-kind reason ever appears.

**Keep `OCR` naming.** Familiar but technically wrong. We use **DocumentExtraction** as the domain term; "scan" is reserved for UI verbs.

**Big-bang migration** of fuel + claim + maintenance services in one PR. Rejected for blast radius — instead we ship the engine + `insurance_policy` kind first (delivering the user-requested feature), then migrate the three legacy services one-by-one under tracked follow-up issues. Old services coexist with the engine until each migrates.

## Consequences

- Adding a new extraction kind = one file in the owning module + one `Module` registration. No HTTP surface to wire in `extraction/`; controllers stay where ownership lives.
- Three legacy services (`FuelLogsOCRService`, `AttachmentExtractionService`, `ClaimExtractionService`) are now technical debt with tracked migration issues. Until migrated, the abstraction is half-adopted — review burden falls on the migration PRs, not on this one.
- `AttachmentExtraction` Prisma model is unchanged. Its row still represents persisted maintenance extractions; it just gets populated by the engine via the maintenance kind's registry entry rather than by a dedicated service.
- If a second provider lands and per-kind routing becomes a real requirement, the registry entry grows a `provider?` field — additive change, no breaking refactor.
