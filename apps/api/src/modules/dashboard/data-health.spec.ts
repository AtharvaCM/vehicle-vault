import { FuelType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { computeDataHealth, DATA_HEALTH_WEIGHTS, type DataHealthInput } from './data-health';

const NOW = new Date('2026-09-22T06:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

/** Everything on file: linked, priced, every category answered, current papers, fresh, tyres. */
const COMPLETE: DataHealthInput = {
  fuelType: FuelType.Petrol,
  catalogVariantId: 'variant-1',
  purchasePrice: 850000,
  serviceCategories: 10,
  unansweredServiceCategories: 0,
  insurance: 'active',
  puc: 'expiring',
  odometerUpdatedAt: daysAgo(3),
  roadTyresTracked: true,
  now: NOW,
};

/** Nothing on file at all, and a reading nobody has touched in months. */
const EMPTY: DataHealthInput = {
  ...COMPLETE,
  catalogVariantId: undefined,
  purchasePrice: null,
  unansweredServiceCategories: 10,
  insurance: 'missing',
  puc: 'missing',
  odometerUpdatedAt: daysAgo(120),
  roadTyresTracked: false,
};

describe('computeDataHealth', () => {
  it('weighs the checks out of exactly 100', () => {
    expect(Object.values(DATA_HEALTH_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });

  it('scores an empty vehicle 0 and asks for its service history first', () => {
    expect(computeDataHealth(EMPTY)).toEqual({ score: 0, nextGap: 'service_history' });
  });

  it('reads a vehicle with everything on file as complete, with nothing to ask', () => {
    expect(computeDataHealth(COMPLETE)).toEqual({ score: 100, nextGap: null });
  });

  it('names the missing check worth the most', () => {
    expect(
      computeDataHealth({ ...COMPLETE, purchasePrice: null, roadTyresTracked: false }),
    ).toEqual({ score: 85, nextGap: 'tyres' });
    expect(
      computeDataHealth({ ...COMPLETE, odometerUpdatedAt: daysAgo(45), puc: 'missing' }),
    ).toEqual({ score: 70, nextGap: 'odometer' });
  });

  it('breaks a tie by the order the weights are listed in', () => {
    // Insurance and the catalog link are worth 15 each; insurance is listed first.
    expect(
      computeDataHealth({ ...COMPLETE, insurance: 'missing', catalogVariantId: undefined }).nextGap,
    ).toBe('insurance');
  });

  it('gives partial credit for service history, and names it only when it is worth most', () => {
    // Half the categories answered: half of 25 lost.
    expect(computeDataHealth({ ...COMPLETE, unansweredServiceCategories: 5 })).toEqual({
      score: 88,
      nextGap: 'service_history',
    });
    // One category of ten left is worth 2.5, less than a missing purchase price.
    expect(
      computeDataHealth({ ...COMPLETE, unansweredServiceCategories: 1, purchasePrice: null })
        .nextGap,
    ).toBe('purchase_price');
  });

  it('counts an expired document as missing: it says nothing about today', () => {
    expect(computeDataHealth({ ...COMPLETE, insurance: 'expired' })).toEqual({
      score: 85,
      nextGap: 'insurance',
    });
  });

  it('does not ask an electric vehicle for a PUC certificate', () => {
    expect(computeDataHealth({ ...COMPLETE, fuelType: FuelType.Electric, puc: 'missing' })).toEqual(
      { score: 100, nextGap: null },
    );
    // Scored out of the 90 that apply to it.
    expect(
      computeDataHealth({
        ...COMPLETE,
        fuelType: FuelType.Electric,
        puc: 'missing',
        purchasePrice: null,
      }),
    ).toEqual({ score: 94, nextGap: 'purchase_price' });
  });

  it('never reads as complete while something is missing', () => {
    // 1 of 100 categories unanswered would round to 100.
    expect(
      computeDataHealth({
        ...COMPLETE,
        serviceCategories: 100,
        unansweredServiceCategories: 1,
      }),
    ).toEqual({ score: 99, nextGap: 'service_history' });
  });
});
