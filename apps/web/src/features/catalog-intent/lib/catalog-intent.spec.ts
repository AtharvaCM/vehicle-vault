import { describe, expect, it } from 'vitest';

import {
  CATALOG_INTENT_TTL_MS,
  afterSignInDestination,
  catalogIntentAttribution,
  clearCatalogIntent,
  isCatalogVariantIntent,
  parseCatalogIntentParam,
  readCatalogIntent,
  saveCatalogIntent,
  toCatalogIntentParam,
  validateCatalogIntentSearch,
  type CatalogIntent,
} from './catalog-intent';

const intent: CatalogIntent = {
  segment: 'cars',
  make: 'honda',
  model: 'city',
  generation: 'city-lineup',
  variant: 'vx-cvt',
};

/** From a model page: make and model, no variant. */
const modelIntent: CatalogIntent = { segment: 'cars', make: 'honda', model: 'city' };

const saved = Date.UTC(2026, 8, 20);

describe('the catalog search parameter', () => {
  it('is the variant page path, and reads back as the same intent', () => {
    const param = toCatalogIntentParam(intent);

    expect(param).toBe('/cars/honda/city/city-lineup/vx-cvt');
    expect(parseCatalogIntentParam(param)).toEqual(intent);
  });

  it('reads without the leading slash too', () => {
    expect(parseCatalogIntentParam('bikes/royal-enfield/classic-350/j-series/chrome')).toEqual({
      segment: 'bikes',
      make: 'royal-enfield',
      model: 'classic-350',
      generation: 'j-series',
      variant: 'chrome',
    });
  });

  it('is the model page path for a model intent, which reads back with no variant', () => {
    const param = toCatalogIntentParam(modelIntent);

    expect(param).toBe('/cars/honda/city');
    expect(parseCatalogIntentParam(param)).toEqual(modelIntent);
    expect(parseCatalogIntentParam('bikes/royal-enfield/classic-350')).toEqual({
      segment: 'bikes',
      make: 'royal-enfield',
      model: 'classic-350',
    });
  });

  it('tells a variant intent from a model intent', () => {
    expect(isCatalogVariantIntent(intent)).toBe(true);
    expect(isCatalogVariantIntent(modelIntent)).toBe(false);
  });

  it.each([
    ['a truck segment', '/trucks/tata/ace/gen/base'],
    ['a truck model', '/trucks/tata/ace'],
    ['a make page', '/cars/honda'],
    ['a generation with no variant', '/cars/honda/city/city-lineup'],
    ['a model with capitals', '/cars/honda/City'],
    ['too many parts', '/cars/honda/city/gen/vx/extra'],
    ['a slug with capitals', '/cars/Honda/city/gen/vx'],
    ['a slug with a space', '/cars/honda/city/gen/vx cvt'],
    ['an empty part', '/cars/honda//gen/vx'],
    ['a number', 42],
    ['nothing', undefined],
  ])('ignores %s', (_label, value) => {
    expect(parseCatalogIntentParam(value)).toBeNull();
  });

  it('is kept by routes only when it is a string, never as an error', () => {
    expect(validateCatalogIntentSearch({ catalog: '/cars/a/b/c/d' })).toEqual({
      catalog: '/cars/a/b/c/d',
    });
    expect(validateCatalogIntentSearch({ catalog: 42 })).toEqual({});
    expect(validateCatalogIntentSearch({})).toEqual({});
  });
});

describe('the stored intent', () => {
  it('reads back what was saved, without using it up', () => {
    saveCatalogIntent(intent, saved);

    expect(readCatalogIntent(saved + 1000)).toEqual(intent);
    expect(readCatalogIntent(saved + 2000)).toEqual(intent);
  });

  it('lasts as long as the verification link, and not a moment longer', () => {
    saveCatalogIntent(intent, saved);

    expect(readCatalogIntent(saved + CATALOG_INTENT_TTL_MS)).toEqual(intent);
    expect(readCatalogIntent(saved + CATALOG_INTENT_TTL_MS + 1)).toBeNull();
    // An expired one is removed, so it cannot come back.
    expect(readCatalogIntent(saved)).toBeNull();
  });

  it('is gone once cleared', () => {
    saveCatalogIntent(intent, saved);
    clearCatalogIntent();

    expect(readCatalogIntent(saved)).toBeNull();
  });

  it('is replaced by a newer one', () => {
    saveCatalogIntent(intent, saved);
    saveCatalogIntent({ ...intent, variant: 'zx' }, saved);

    expect(readCatalogIntent(saved)?.variant).toBe('zx');
  });

  it('keeps a model intent the same way, with no variant', () => {
    saveCatalogIntent(modelIntent, saved);

    expect(readCatalogIntent(saved + 1000)).toEqual(modelIntent);
    expect(afterSignInDestination(saved + 1000)).toBe('/vehicles/new');
  });

  it('reads an intent saved before model intents existed', () => {
    window.localStorage.setItem(
      'vehicle-vault.catalog-intent',
      JSON.stringify({ version: 1, intent, savedAt: saved }),
    );

    expect(readCatalogIntent(saved)).toEqual(intent);
  });

  it.each([
    ['not JSON', '{'],
    ['another version', JSON.stringify({ version: 2, intent, savedAt: saved })],
    ['no save time', JSON.stringify({ version: 1, intent })],
    ['a saved time in the future', JSON.stringify({ version: 1, intent, savedAt: saved + 1 })],
    [
      'a tampered slug',
      JSON.stringify({ version: 1, intent: { ...intent, model: 'a@b.test' }, savedAt: saved }),
    ],
    [
      'a generation with no variant',
      JSON.stringify({
        version: 1,
        intent: { ...modelIntent, generation: 'city-lineup' },
        savedAt: saved,
      }),
    ],
  ])('reads as none, and is removed, when it is %s', (_label, raw) => {
    window.localStorage.setItem('vehicle-vault.catalog-intent', raw);

    expect(readCatalogIntent(saved)).toBeNull();
    expect(window.localStorage.getItem('vehicle-vault.catalog-intent')).toBeNull();
  });

  it('reads as none when storage cannot be reached', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });

    expect(() => saveCatalogIntent(intent, saved)).not.toThrow();
    expect(readCatalogIntent(saved)).toBeNull();
    expect(() => clearCatalogIntent()).not.toThrow();
  });
});

describe('what signing up and signing in do with it', () => {
  it('attributes a sign-up to the model, and sends nothing without an intent', () => {
    expect(catalogIntentAttribution(intent)).toEqual({ catalogModel: 'city' });
    expect(catalogIntentAttribution(modelIntent)).toEqual({ catalogModel: 'city' });
    expect(catalogIntentAttribution(null)).toEqual({});
  });

  it('goes on to the add-vehicle form while an intent waits, else the dashboard', () => {
    expect(afterSignInDestination(saved)).toBe('/home');

    saveCatalogIntent(intent, saved);
    expect(afterSignInDestination(saved)).toBe('/vehicles/new');
  });
});
