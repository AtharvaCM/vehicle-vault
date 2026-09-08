import {
  ServiceBaselineStatus,
  type ServiceBaselineEntryInput,
  type VehicleServiceBaselineEntry,
} from '@vehicle-vault/shared';

/**
 * What the user has typed for one category, before it is a valid answer.
 *
 * `unset` is a real option rather than the absence of a draft: leaving a
 * category blank must stay possible, and it means something different from
 * saying "I don't know" — the app keeps guessing for the first and stops for
 * the second.
 */
export type BaselineDraft = {
  status: ServiceBaselineStatus | 'unset';
  odometer: string;
};

export type BaselineDrafts = Record<string, BaselineDraft>;

/** A logged service supersedes any baseline, so those rows are not editable. */
export function isEditable(entry: VehicleServiceBaselineEntry): boolean {
  return entry.source !== 'record';
}

export function deriveDrafts(entries: VehicleServiceBaselineEntry[]): BaselineDrafts {
  const drafts: BaselineDrafts = {};

  for (const entry of entries) {
    if (!isEditable(entry)) continue;

    if (entry.source === 'declared-unknown') {
      drafts[entry.category] = { status: ServiceBaselineStatus.Unknown, odometer: '' };
      continue;
    }

    if (entry.source === 'baseline') {
      drafts[entry.category] = {
        status: ServiceBaselineStatus.Known,
        odometer: entry.lastDoneOdometer?.toString() ?? '',
      };
      continue;
    }

    drafts[entry.category] = { status: 'unset', odometer: '' };
  }

  return drafts;
}

function parseOdometer(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return null;

  return parsed;
}

/**
 * The entries worth sending: editable, answered, valid, and actually different
 * from what the server already has.
 *
 * Unchanged rows are dropped rather than sent, because every upsert writes an
 * audit event — re-saving a screen would otherwise fill a vehicle's Activity
 * with rows recording that nothing changed.
 */
export function buildBaselineEntries(
  entries: VehicleServiceBaselineEntry[],
  drafts: BaselineDrafts,
): ServiceBaselineEntryInput[] {
  const payload: ServiceBaselineEntryInput[] = [];

  for (const entry of entries) {
    if (!isEditable(entry)) continue;

    const draft = drafts[entry.category];
    if (!draft || draft.status === 'unset') continue;

    if (draft.status === ServiceBaselineStatus.Unknown) {
      if (entry.source === 'declared-unknown') continue;
      payload.push({ category: entry.category, status: ServiceBaselineStatus.Unknown });
      continue;
    }

    const odometer = parseOdometer(draft.odometer);
    // A "known" answer with nothing in the box is an unfinished thought, not a
    // claim. The server would reject it; dropping it keeps the rest saveable.
    if (odometer == null) continue;
    if (entry.source === 'baseline' && entry.lastDoneOdometer === odometer) continue;

    payload.push({
      category: entry.category,
      status: ServiceBaselineStatus.Known,
      lastDoneOdometer: odometer,
    });
  }

  return payload;
}
