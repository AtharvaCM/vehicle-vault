import {
  carBodyTypeChipFromSlug,
  carBodyTypeSlug,
  normaliseCarBodyType,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { carBodyTypeFill, carWaleJsonLdBodyType, curatedCarBodyType } from './car-body-type';

function page(...nodes: unknown[]) {
  return nodes
    .map((node) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`)
    .join('\n');
}

describe('normaliseCarBodyType', () => {
  it.each([
    ['Hatchback', 'Hatchback'],
    ['SUV', 'SUV'],
    ['CompactSuv', 'SUV'],
    ['Coupe SUV', 'SUV'],
    ['MuvsMpvs', 'MUV'],
    ['Minivan', 'MUV'],
    ['Sedan', 'Sedan'],
    ['CompactSedan', 'Sedan'],
    ['Coupe', 'Coupe'],
    ['Convertible', 'Convertible'],
    ['Pickup', 'Pickup'],
    ['Pickup Truck', 'Pickup'],
    ['StationWagon', 'Wagon'],
  ])('reads %s as %s', (raw, expected) => {
    expect(normaliseCarBodyType(raw)).toBe(expected);
  });

  it.each([null, undefined, '', '  ', 'Street', 'Cruiser', 'Scooter'])(
    'has no car body type for %j',
    (raw) => {
      expect(normaliseCarBodyType(raw)).toBeNull();
    },
  );
});

describe('car body type chip slugs', () => {
  it('round-trips each chip through its URL value', () => {
    expect(carBodyTypeSlug('SUV')).toBe('suv');
    expect(carBodyTypeChipFromSlug('suv')).toBe('SUV');
    expect(carBodyTypeChipFromSlug('MUV')).toBe('MUV');
  });

  it('offers no chip for a body type that has none, or for junk', () => {
    expect(carBodyTypeChipFromSlug('coupe')).toBeNull();
    expect(carBodyTypeChipFromSlug('bus')).toBeNull();
    expect(carBodyTypeChipFromSlug(null)).toBeNull();
  });
});

describe('carWaleJsonLdBodyType', () => {
  it('reads a node typed "Car"', () => {
    expect(carWaleJsonLdBodyType(page({ '@type': 'Car', bodyType: 'Hatchback' }))).toBe(
      'Hatchback',
    );
  });

  it('reads a node typed ["Car", "ProductGroup"], as newer pages are', () => {
    const html = page(
      { '@type': 'VideoObject', name: 'Review' },
      { '@type': ['Car', 'ProductGroup'], bodyType: 'SUV' },
    );
    expect(carWaleJsonLdBodyType(html)).toBe('SUV');
  });

  it('reads nodes inside @graph and takes the first of a list', () => {
    const html = page({ '@graph': [{ '@type': 'Car', bodyType: ['MuvsMpvs', 'SUV'] }] });
    expect(carWaleJsonLdBodyType(html)).toBe('MuvsMpvs');
  });

  it('skips malformed blocks and pages with no car node', () => {
    const html = `<script type="application/ld+json">{not json</script>${page({
      '@type': 'FAQPage',
    })}`;
    expect(carWaleJsonLdBodyType(html)).toBeNull();
  });
});

describe('carBodyTypeFill', () => {
  it("fills an empty field with the model's body type", () => {
    expect(carBodyTypeFill(null, 'SUV')).toEqual({ action: 'fill', bodyType: 'SUV' });
  });

  it("relabels a source's label and keeps the variant's own shape", () => {
    expect(carBodyTypeFill('CompactSedan', 'Hatchback')).toEqual({
      action: 'relabel',
      bodyType: 'Sedan',
    });
  });

  it("leaves a catalog label alone, even when the model's differs", () => {
    expect(carBodyTypeFill('Sedan', 'Hatchback')).toEqual({ action: 'none' });
  });

  it('lets the curated table overrule a value on file', () => {
    expect(carBodyTypeFill('SUV', 'Sedan', { authoritative: true })).toEqual({
      action: 'correct',
      bodyType: 'Sedan',
    });
    expect(carBodyTypeFill('Sedan', 'Sedan', { authoritative: true })).toEqual({ action: 'none' });
    expect(carBodyTypeFill(null, 'Sedan', { authoritative: true })).toEqual({
      action: 'fill',
      bodyType: 'Sedan',
    });
  });

  it('leaves a value it cannot read, and an empty field with nothing to fill', () => {
    expect(carBodyTypeFill('Off-roader', 'SUV')).toEqual({ action: 'none' });
    expect(carBodyTypeFill(null, null)).toEqual({ action: 'none' });
  });
});

describe('curatedCarBodyType', () => {
  it('corrects CarWale where it is wrong, and knows nothing it was not told', () => {
    expect(curatedCarBodyType('hyundai', 'ioniq-6')).toBe('Sedan');
    expect(curatedCarBodyType('hyundai', 'creta')).toBeNull();
  });
});
