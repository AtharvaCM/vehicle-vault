import { TyrePosition } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  TyreConditionResolver,
  type TyreConditionInput,
} from './tyre-condition.resolver';

const NOW = new Date('2026-08-25T00:00:00.000Z');

function makeTyre(overrides: Partial<TyreConditionInput> = {}): TyreConditionInput {
  return {
    id: 'tyre-1',
    position: TyrePosition.FrontLeft,
    dotWeek: 10,
    dotYear: 2026,
    fittedOdometer: 0,
    expectedLifeKm: null,
    inspections: [],
    ...overrides,
  };
}

describe('TyreConditionResolver', () => {
  let resolver: TyreConditionResolver;

  beforeEach(() => {
    resolver = new TyreConditionResolver();
  });

  it('reports unknown when nothing has been measured', () => {
    const condition = resolver.resolve(
      makeTyre({ dotWeek: null, dotYear: null }),
      6908,
      NOW,
    );

    expect(condition.level).toBe('unknown');
    expect(condition.treadDepthMm).toBeNull();
    expect(condition.ageYears).toBeNull();
    expect(condition.kmOnTyre).toBe(6908);
  });

  it('calls tread below the legal minimum illegal, not merely due', () => {
    const condition = resolver.resolve(
      makeTyre({
        inspections: [{ inspectedAt: NOW, odometer: 40_000, treadDepthMm: 1.4 }],
      }),
      40_000,
      NOW,
    );

    // A roadworthiness statement is a different class of claim from "service due".
    expect(condition.level).toBe('illegal');
    expect(condition.reason).toBe('tread');
    expect(condition.summary).toContain('1.6 mm legal minimum');
  });

  it('flags reduced wet grip below 3 mm before the legal limit is reached', () => {
    const condition = resolver.resolve(
      makeTyre({
        inspections: [{ inspectedAt: NOW, odometer: 35_000, treadDepthMm: 2.5 }],
      }),
      35_000,
      NOW,
    );

    expect(condition.level).toBe('replace');
    expect(condition.reason).toBe('tread');
  });

  it('ages a tyre out on its DOT code even with full tread', () => {
    const condition = resolver.resolve(
      makeTyre({
        dotWeek: 10,
        dotYear: 2019,
        inspections: [{ inspectedAt: NOW, odometer: 5_000, treadDepthMm: 7.5 }],
      }),
      5_000,
      NOW,
    );

    // The failure a distance-based schedule structurally cannot see: barely
    // driven, plenty of tread, rubber too old to trust.
    expect(condition.level).toBe('replace');
    expect(condition.reason).toBe('age');
    expect(condition.ageYears).toBeGreaterThan(7);
  });

  it('lets the worse of tread and age decide', () => {
    const condition = resolver.resolve(
      makeTyre({
        dotWeek: 1,
        dotYear: 2021, // ~5.6 years -> warn
        inspections: [{ inspectedAt: NOW, odometer: 50_000, treadDepthMm: 1.2 }], // illegal
      }),
      50_000,
      NOW,
    );

    expect(condition.level).toBe('illegal');
    expect(condition.reason).toBe('tread');
  });

  it('projects remaining life from the observed wear rate', () => {
    const condition = resolver.resolve(
      makeTyre({
        inspections: [
          // Newest first. 8mm -> 6mm over 20,000 km = 0.0001 mm/km.
          { inspectedAt: new Date('2026-08-01'), odometer: 20_000, treadDepthMm: 6 },
          { inspectedAt: new Date('2025-08-01'), odometer: 0, treadDepthMm: 8 },
        ],
      }),
      20_000,
      NOW,
    );

    // 3mm of usable tread left above the 3mm replace threshold, at 0.0001 mm/km.
    expect(condition.estimatedKmRemaining).toBe(30_000);
  });

  it('discounts distance driven since the last reading', () => {
    const condition = resolver.resolve(
      makeTyre({
        inspections: [
          { inspectedAt: new Date('2026-08-01'), odometer: 20_000, treadDepthMm: 6 },
          { inspectedAt: new Date('2025-08-01'), odometer: 0, treadDepthMm: 8 },
        ],
      }),
      25_000,
      NOW,
    );

    expect(condition.estimatedKmRemaining).toBe(25_000);
  });

  it('falls back to expected life when there are too few readings to model wear', () => {
    const condition = resolver.resolve(
      makeTyre({
        expectedLifeKm: 45_000,
        fittedOdometer: 10_000,
        inspections: [{ inspectedAt: NOW, odometer: 25_000, treadDepthMm: 6 }],
      }),
      25_000,
      NOW,
    );

    expect(condition.estimatedKmRemaining).toBe(30_000);
  });

  it('returns null remaining life when there is nothing to project from', () => {
    const condition = resolver.resolve(makeTyre(), 5_000, NOW);

    expect(condition.estimatedKmRemaining).toBeNull();
  });

  it('does not project from readings that show no wear', () => {
    const condition = resolver.resolve(
      makeTyre({
        inspections: [
          { inspectedAt: new Date('2026-08-01'), odometer: 20_000, treadDepthMm: 8 },
          { inspectedAt: new Date('2025-08-01'), odometer: 0, treadDepthMm: 8 },
        ],
      }),
      20_000,
      NOW,
    );

    // Zero measured wear would divide by zero and project infinite life.
    expect(condition.estimatedKmRemaining).toBeNull();
  });

  it('lets the worst corner decide the vehicle verdict', () => {
    const healthy = resolver.resolve(
      makeTyre({ inspections: [{ inspectedAt: NOW, odometer: 5_000, treadDepthMm: 7 }] }),
      5_000,
      NOW,
    );
    const bald = resolver.resolve(
      makeTyre({
        id: 'tyre-2',
        position: TyrePosition.FrontRight,
        inspections: [{ inspectedAt: NOW, odometer: 5_000, treadDepthMm: 1.2 }],
      }),
      5_000,
      NOW,
    );

    expect(resolver.worstLevel([healthy, healthy, healthy, bald])).toBe('illegal');
    expect(resolver.worstLevel([healthy, healthy])).toBe('healthy');
    expect(resolver.worstLevel([])).toBe('unknown');
  });
});
