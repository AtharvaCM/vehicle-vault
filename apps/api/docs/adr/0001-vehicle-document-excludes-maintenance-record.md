# VehicleDocument excludes MaintenanceRecord

**Status**: accepted

When unifying **InsurancePolicy** and **Warranty** into a single **VehicleDocument** module, the obvious next move is to fold **MaintenanceRecord** in too — both are "things attached to a Vehicle." We deliberately did not.

**MaintenanceRecord** has line items, currency math, an OCR ingestion pipeline (`AttachmentExtraction`), and feeds forecasting (`MaintenanceForecastService`). **VehicleDocument** is a validity-window + provider record. The shapes differ; more importantly the *behaviour* differs — a `findExpiring(withinDays)` query has no meaningful analogue for maintenance, and a `lineItems`/`totalCost` projection has no meaningful analogue for documents.

Folding them would either flatten **VehicleDocument**'s interface into a lowest-common-denominator CRUD bag, or push maintenance-specific complexity behind a `kind` discriminator that every caller would have to switch on. Both lose the depth this refactor is trying to create.

If a future doc type appears that genuinely overlaps maintenance semantics (e.g. "service contract" with scheduled visits and line items), revisit this decision — it would be the load-bearing case for collapsing the boundary.
