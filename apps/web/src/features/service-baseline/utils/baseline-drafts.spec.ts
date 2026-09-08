import {
  MaintenanceCategory,
  ServiceBaselineStatus,
  type VehicleServiceBaselineEntry,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { buildBaselineEntries, deriveDrafts, isEditable } from './baseline-drafts';

const entry = (
  overrides: Partial<VehicleServiceBaselineEntry> = {},
): VehicleServiceBaselineEntry => ({
  category: MaintenanceCategory.BrakePads,
  source: 'unset',
  lastDoneOdometer: null,
  lastDoneDate: null,
  baseline: null,
  ...overrides,
});

describe('deriveDrafts', () => {
  it('starts an unanswered category blank rather than at zero', () => {
    // Prefilling 0 would read as "done at 0 km", which is an answer nobody gave.
    expect(deriveDrafts([entry()])).toEqual({
      [MaintenanceCategory.BrakePads]: { status: 'unset', odometer: '' },
    });
  });

  it('reflects a stored reading and a stored unknown differently', () => {
    const drafts = deriveDrafts([
      entry({ source: 'baseline', lastDoneOdometer: 5_000 }),
      entry({ category: MaintenanceCategory.Coolant, source: 'declared-unknown' }),
    ]);

    expect(drafts[MaintenanceCategory.BrakePads]).toEqual({
      status: ServiceBaselineStatus.Known,
      odometer: '5000',
    });
    expect(drafts[MaintenanceCategory.Coolant]).toEqual({
      status: ServiceBaselineStatus.Unknown,
      odometer: '',
    });
  });

  it('leaves a category answered by a logged service out entirely', () => {
    const record = entry({ source: 'record', lastDoneOdometer: 38_000 });

    expect(isEditable(record)).toBe(false);
    expect(deriveDrafts([record])).toEqual({});
  });
});

describe('buildBaselineEntries', () => {
  it('sends a newly entered reading', () => {
    const entries = [entry()];
    const drafts = {
      [MaintenanceCategory.BrakePads]: { status: ServiceBaselineStatus.Known, odometer: '5000' },
    };

    expect(buildBaselineEntries(entries, drafts)).toEqual([
      {
        category: MaintenanceCategory.BrakePads,
        status: ServiceBaselineStatus.Known,
        lastDoneOdometer: 5_000,
      },
    ]);
  });

  it('sends an explicit unknown', () => {
    const entries = [entry()];
    const drafts = {
      [MaintenanceCategory.BrakePads]: { status: ServiceBaselineStatus.Unknown, odometer: '' },
    };

    expect(buildBaselineEntries(entries, drafts)).toEqual([
      { category: MaintenanceCategory.BrakePads, status: ServiceBaselineStatus.Unknown },
    ]);
  });

  it('leaves a blank category alone instead of answering it', () => {
    // Untouched is not the same claim as "I don't know", and only the second
    // one should stop the engine guessing.
    const entries = [entry()];
    const drafts = { [MaintenanceCategory.BrakePads]: { status: 'unset' as const, odometer: '' } };

    expect(buildBaselineEntries(entries, drafts)).toEqual([]);
  });

  it('drops rows that would only rewrite what is already stored', () => {
    // Every upsert writes an audit event, so re-saving an untouched screen
    // would fill the vehicle's Activity with rows recording nothing.
    const entries = [
      entry({ source: 'baseline', lastDoneOdometer: 5_000 }),
      entry({ category: MaintenanceCategory.Coolant, source: 'declared-unknown' }),
    ];
    const drafts = {
      [MaintenanceCategory.BrakePads]: {
        status: ServiceBaselineStatus.Known,
        odometer: '5000',
      },
      [MaintenanceCategory.Coolant]: {
        status: ServiceBaselineStatus.Unknown,
        odometer: '',
      },
    };

    expect(buildBaselineEntries(entries, drafts)).toEqual([]);
  });

  it('sends a corrected reading', () => {
    const entries = [entry({ source: 'baseline', lastDoneOdometer: 5_000 })];
    const drafts = {
      [MaintenanceCategory.BrakePads]: {
        status: ServiceBaselineStatus.Known,
        odometer: '12000',
      },
    };

    expect(buildBaselineEntries(entries, drafts)).toEqual([
      {
        category: MaintenanceCategory.BrakePads,
        status: ServiceBaselineStatus.Known,
        lastDoneOdometer: 12_000,
      },
    ]);
  });

  it('never sends a category a logged service already answers', () => {
    const entries = [entry({ source: 'record', lastDoneOdometer: 38_000 })];
    const drafts = {
      [MaintenanceCategory.BrakePads]: {
        status: ServiceBaselineStatus.Known,
        odometer: '5000',
      },
    };

    expect(buildBaselineEntries(entries, drafts)).toEqual([]);
  });

  it.each(['', '  ', 'abc', '-5', '12.5'])(
    'holds back a known answer with an unusable reading (%s)',
    (odometer) => {
      // The server rejects the whole batch, so one half-typed box must not
      // block the categories that were answered properly.
      const entries = [entry()];
      const drafts = {
        [MaintenanceCategory.BrakePads]: { status: ServiceBaselineStatus.Known, odometer },
      };

      expect(buildBaselineEntries(entries, drafts)).toEqual([]);
    },
  );
});
