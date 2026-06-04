import { describe, expect, it } from 'vitest';

import { computeUsageCadence, projectDueDate } from './usage-projection';

function sample(daysAgo: number, odometer: number, asOf: Date) {
  return { date: new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000), odometer };
}

describe('computeUsageCadence', () => {
  const asOf = new Date('2026-06-04T00:00:00.000Z');

  it('returns null with fewer than two samples', () => {
    expect(computeUsageCadence([], asOf)).toBeNull();
    expect(computeUsageCadence([sample(10, 1000, asOf)], asOf)).toBeNull();
  });

  it('returns null when odometer does not advance', () => {
    expect(
      computeUsageCadence(
        [sample(60, 5000, asOf), sample(10, 5000, asOf)],
        asOf,
      ),
    ).toBeNull();
  });

  it('returns null when only old samples exist outside the window', () => {
    expect(
      computeUsageCadence(
        [sample(400, 1000, asOf), sample(380, 2000, asOf)],
        asOf,
        180,
      ),
    ).toBeNull();
  });

  it('marks high confidence with 6+ samples over 90+ days', () => {
    const samples = [
      sample(150, 10000, asOf),
      sample(120, 11500, asOf),
      sample(90, 13000, asOf),
      sample(60, 14500, asOf),
      sample(30, 16000, asOf),
      sample(5, 17500, asOf),
    ];
    const cadence = computeUsageCadence(samples, asOf);
    expect(cadence).not.toBeNull();
    expect(cadence!.confidence).toBe('high');
    expect(cadence!.kmPerDay).toBeGreaterThan(40);
    expect(cadence!.kmPerDay).toBeLessThan(60);
  });

  it('marks medium confidence with 3 samples / 30+ days', () => {
    const samples = [
      sample(50, 10000, asOf),
      sample(25, 11000, asOf),
      sample(5, 12000, asOf),
    ];
    const cadence = computeUsageCadence(samples, asOf);
    expect(cadence!.confidence).toBe('medium');
  });

  it('marks low confidence for sparse recent samples', () => {
    const cadence = computeUsageCadence(
      [sample(10, 10000, asOf), sample(2, 10300, asOf)],
      asOf,
    );
    expect(cadence!.confidence).toBe('low');
  });
});

describe('projectDueDate', () => {
  const asOf = new Date('2026-06-04T00:00:00.000Z');
  const cadence = { kmPerDay: 50, sampleCount: 6, sampleDays: 120, confidence: 'high' as const };

  it('projects future date for distance still ahead', () => {
    const projected = projectDueDate(10000, 15000, cadence, asOf);
    // 5000 km / 50 km/day = 100 days.
    const expected = new Date(asOf.getTime() + 100 * 24 * 60 * 60 * 1000);
    expect(projected.getTime()).toBe(expected.getTime());
  });

  it('returns asOf when already past dueOdometer', () => {
    const projected = projectDueDate(20000, 15000, cadence, asOf);
    expect(projected.getTime()).toBe(asOf.getTime());
  });
});
