# Notification dedup key is owned by per-kind template, not generic

**Status**: accepted

`Notification` has a `kind` column and a `dedupKey` column. The uniqueness of an unread notification is enforced by a partial unique index on `(userId, dedupKey) WHERE isRead = false`. Each alert template computes its own `dedupKey` from the payload — for example, `insurance:<policyId>:7d` for the 7-day-before-expiry bucket, or `maintenance:<vehicleId>:<category>` for category-overdue alerts.

The previous design deduplicated by `(userId, vehicleId, title)` for unread rows. This collided whenever two semantically different alerts shared a title prefix and silently dropped one. It also forced producers to know the exact title string already in flight to dedup intentionally — a fragile coupling between alert content and alert identity.

Reverting to title-based or any generic key is the obvious "simplification" a future contributor will reach for. Resist it. Different alert kinds dedupe on different facts (a policy id, a maintenance category, a reminder id, a daysBucket). The template knows; a generic key cannot. If a new alert kind appears, its dedupKey function is part of the template, not a column you stuff into a shared bag.
