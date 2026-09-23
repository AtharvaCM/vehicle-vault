import { FuelType, type PublicCatalogSpec } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  countFilledSpecFields,
  evaluateModelPageQuality,
  evaluateVariantPageQuality,
  MIN_FILLED_PUBLIC_SPEC_FIELDS,
} from './page-quality';
import { PUBLIC_SPEC_FIELDS } from './public-catalog.service';

/** Every public field empty, then the given ones filled. */
function specs(values: Partial<PublicCatalogSpec>): PublicCatalogSpec {
  const empty = Object.fromEntries(PUBLIC_SPEC_FIELDS.map((field) => [field, null]));
  return { ...empty, ...values } as PublicCatalogSpec;
}

/** The two required facts for a petrol car, plus padding up to `filled` fields in all. */
function petrolSpecs(filled: number, overrides: Partial<PublicCatalogSpec> = {}) {
  const required: Partial<PublicCatalogSpec> = { engineCc: 1197, mileageCombined: 20.3 };
  const padding: Partial<PublicCatalogSpec> = {
    engineCyl: 4,
    powerRpm: 6000,
    torqueNm: 115,
    torqueRpm: 4200,
    transmission: 'Manual',
    lengthMm: 3995,
    widthMm: 1775,
    heightMm: 1505,
    wheelbaseMm: 2580,
    fuelCapLitres: 37,
    seatingCapacity: 5,
    tyreSize: '195/55 R16',
  };
  const extra = Object.entries(padding).slice(0, filled - 2);
  return specs({ ...required, ...Object.fromEntries(extra), ...overrides });
}

/** An EV with range and motor output, plus padding up to `filled` fields in all. */
function electricSpecs(filled: number, overrides: Partial<PublicCatalogSpec> = {}) {
  const required: Partial<PublicCatalogSpec> = { rangeKm: 489, motorKw: 110 };
  const padding: Partial<PublicCatalogSpec> = {
    batteryKwh: 45,
    acChargeKw: 7.2,
    dcFastChargeKw: 60,
    chargeTime0To80Min: 40,
    torqueNm: 215,
    transmission: 'Automatic',
    lengthMm: 3994,
    widthMm: 1811,
    heightMm: 1616,
    seatingCapacity: 5,
    bootSpaceLitres: 350,
  };
  const extra = Object.entries(padding).slice(0, filled - 2);
  return specs({ ...required, ...Object.fromEntries(extra), ...overrides });
}

describe('evaluateVariantPageQuality', () => {
  it('rejects a variant with no spec row at all', () => {
    expect(evaluateVariantPageQuality({ fuelType: FuelType.Petrol, specs: null })).toEqual({
      indexable: false,
      reasons: ['no-specs'],
    });
  });

  describe('the filled-field threshold', () => {
    it(`passes at exactly ${MIN_FILLED_PUBLIC_SPEC_FIELDS} filled fields`, () => {
      const atThreshold = petrolSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS);
      expect(countFilledSpecFields(atThreshold)).toBe(MIN_FILLED_PUBLIC_SPEC_FIELDS);

      expect(evaluateVariantPageQuality({ fuelType: FuelType.Petrol, specs: atThreshold })).toEqual(
        { indexable: true, reasons: [] },
      );
    });

    it('fails one field short', () => {
      const oneShort = petrolSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS - 1);
      expect(countFilledSpecFields(oneShort)).toBe(MIN_FILLED_PUBLIC_SPEC_FIELDS - 1);

      expect(evaluateVariantPageQuality({ fuelType: FuelType.Petrol, specs: oneShort })).toEqual({
        indexable: false,
        reasons: ['too-few-specs'],
      });
    });

    it('counts false as a fact but not an empty string or a missing value', () => {
      expect(countFilledSpecFields(specs({ hasAbs: false, hasEsc: true }))).toBe(2);
      expect(countFilledSpecFields(specs({ bodyType: '  ', tyreSize: '' }))).toBe(0);
      expect(countFilledSpecFields(specs({}))).toBe(0);
    });
  });

  describe('a combustion variant', () => {
    it('needs a claimed mileage, however many other fields it has', () => {
      const result = evaluateVariantPageQuality({
        fuelType: FuelType.Diesel,
        specs: petrolSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS + 1, {
          mileageCombined: null,
          topSpeedKph: 180,
        }),
      });

      expect(result).toEqual({ indexable: false, reasons: ['no-claimed-mileage'] });
    });

    it('needs engine data, and power alone will do', () => {
      const noEngine = petrolSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS + 1, {
        engineCc: null,
        topSpeedKph: 180,
      });
      expect(evaluateVariantPageQuality({ fuelType: FuelType.Petrol, specs: noEngine })).toEqual({
        indexable: false,
        reasons: ['no-engine-data'],
      });

      expect(
        evaluateVariantPageQuality({
          fuelType: FuelType.Petrol,
          specs: { ...noEngine, powerPs: 83 },
        }).indexable,
      ).toBe(true);
    });

    it('is not rescued by a range: a bike range is a tank, not a battery', () => {
      const result = evaluateVariantPageQuality({
        fuelType: FuelType.Petrol,
        specs: petrolSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS, { mileageCombined: null, rangeKm: 450 }),
      });

      expect(result.reasons).toEqual(['no-claimed-mileage']);
    });

    it('lists every reason at once', () => {
      const result = evaluateVariantPageQuality({
        fuelType: FuelType.Petrol,
        specs: specs({ transmission: 'Manual' }),
      });

      expect(result).toEqual({
        indexable: false,
        reasons: ['too-few-specs', 'no-claimed-mileage', 'no-engine-data'],
      });
    });
  });

  describe('an electric variant', () => {
    it('is indexable on range and motor data, with no mileage or engine', () => {
      const ev = electricSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS);
      expect(ev.mileageCombined).toBeNull();
      expect(ev.engineCc).toBeNull();

      expect(evaluateVariantPageQuality({ fuelType: FuelType.Electric, specs: ev })).toEqual({
        indexable: true,
        reasons: [],
      });
    });

    it('fails one field short, like any other variant', () => {
      expect(
        evaluateVariantPageQuality({
          fuelType: FuelType.Electric,
          specs: electricSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS - 1),
        }),
      ).toEqual({ indexable: false, reasons: ['too-few-specs'] });
    });

    it('needs a claimed range, and a mileage figure does not stand in for it', () => {
      const result = evaluateVariantPageQuality({
        fuelType: FuelType.Electric,
        specs: electricSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS, {
          rangeKm: null,
          mileageCombined: 20,
        }),
      });

      expect(result).toEqual({ indexable: false, reasons: ['no-claimed-range'] });
    });

    it('needs motor data: motor output or power', () => {
      const noMotor = electricSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS + 1, { motorKw: null });
      expect(evaluateVariantPageQuality({ fuelType: FuelType.Electric, specs: noMotor })).toEqual({
        indexable: false,
        reasons: ['no-motor-data'],
      });

      expect(
        evaluateVariantPageQuality({
          fuelType: FuelType.Electric,
          specs: { ...noMotor, powerPs: 143 },
        }).indexable,
      ).toBe(true);
    });

    it('is judged as a combustion variant when it is not sold as electric', () => {
      // The same facts, on a hybrid: it has no claimed mileage, so it fails.
      const result = evaluateVariantPageQuality({
        fuelType: FuelType.Hybrid,
        specs: electricSpecs(MIN_FILLED_PUBLIC_SPEC_FIELDS),
      });

      expect(result.reasons).toEqual(['no-claimed-mileage', 'no-engine-data']);
    });
  });
});

describe('evaluateModelPageQuality', () => {
  const pass = { indexable: true, reasons: [] };
  const fail = { indexable: false, reasons: ['too-few-specs' as const] };

  it('is indexable when any one variant is', () => {
    expect(evaluateModelPageQuality([fail, pass, fail])).toEqual(pass);
  });

  it('is not when none is, or when it has no variants', () => {
    expect(evaluateModelPageQuality([fail, fail])).toEqual({
      indexable: false,
      reasons: ['no-indexable-variant'],
    });
    expect(evaluateModelPageQuality([]).indexable).toBe(false);
  });
});
