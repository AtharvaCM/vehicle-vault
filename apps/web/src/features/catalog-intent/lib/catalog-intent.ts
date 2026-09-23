import {
  CATALOG_SLUG_MAX_LENGTH,
  CATALOG_SLUG_PATTERN,
  isPublicCatalogSegment,
  type PublicCatalogSegment,
} from '@vehicle-vault/shared';

/**
 * A **catalog intent**: the catalog variant a visitor asked to track by pressing
 * "Track this vehicle" on its public page. It travels as the `catalog` search
 * parameter to `/register` or `/vehicles/new`, is kept in `localStorage` for a
 * few days so it survives registration, email verification and signing in, and
 * is read once by the add-vehicle form, which prefills make, model and variant
 * from it and clears it.
 *
 * It is the variant's public page address, not its database id: that is what
 * the page has, and the public page endpoint resolves it back to the names the
 * form's catalog pickers use.
 */
export type CatalogIntent = {
  segment: PublicCatalogSegment;
  make: string;
  model: string;
  generation: string;
  variant: string;
};

export type CatalogIntentSearch = {
  catalog?: string;
};

/**
 * As long as the emailed verification link lasts, so an intent is still there
 * for anyone who verifies with it. Long enough to finish signing up, short
 * enough that an abandoned visit does not prefill an unrelated vehicle later.
 */
export const CATALOG_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STORAGE_KEY = 'vehicle-vault.catalog-intent';
const STORAGE_VERSION = 1;

type StoredCatalogIntent = {
  version: typeof STORAGE_VERSION;
  intent: CatalogIntent;
  savedAt: number;
};

function isCatalogSlug(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= CATALOG_SLUG_MAX_LENGTH &&
    CATALOG_SLUG_PATTERN.test(value)
  );
}

function toCatalogIntent(value: {
  segment: unknown;
  make: unknown;
  model: unknown;
  generation: unknown;
  variant: unknown;
}): CatalogIntent | null {
  const { segment, make, model, generation, variant } = value;

  if (
    typeof segment !== 'string' ||
    !isPublicCatalogSegment(segment) ||
    !isCatalogSlug(make) ||
    !isCatalogSlug(model) ||
    !isCatalogSlug(generation) ||
    !isCatalogSlug(variant)
  ) {
    return null;
  }

  return { segment, make, model, generation, variant };
}

/** The `catalog` search parameter for an intent: the variant page's own path. */
export function toCatalogIntentParam(intent: CatalogIntent): string {
  return `/${intent.segment}/${intent.make}/${intent.model}/${intent.generation}/${intent.variant}`;
}

/** The intent in a `catalog` search parameter, or null for anything that is not a variant path. */
export function parseCatalogIntentParam(value: unknown): CatalogIntent | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parts = value.replace(/^\//, '').split('/');

  if (parts.length !== 5) {
    return null;
  }

  const [segment, make, model, generation, variant] = parts;
  return toCatalogIntent({ segment, make, model, generation, variant });
}

/**
 * `validateSearch` for the routes that take a `catalog` parameter. Lenient on
 * purpose: a bad value is dropped here and ignored later, never an error page.
 */
export function validateCatalogIntentSearch(search: Record<string, unknown>): CatalogIntentSearch {
  return typeof search.catalog === 'string' ? { catalog: search.catalog } : {};
}

/** Keeps an intent for later, replacing any earlier one. */
export function saveCatalogIntent(intent: CatalogIntent, now: number = Date.now()) {
  try {
    const stored: StoredCatalogIntent = { version: STORAGE_VERSION, intent, savedAt: now };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage off or full: the visitor picks the vehicle by hand, as before.
  }
}

/**
 * The stored intent, without using it up. An expired or unreadable one is
 * removed and reads as none.
 */
export function readCatalogIntent(now: number = Date.now()): CatalogIntent | null {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  const intent = parseStoredIntent(raw, now);

  if (!intent) {
    clearCatalogIntent();
  }

  return intent;
}

function parseStoredIntent(raw: string, now: number): CatalogIntent | null {
  try {
    const stored = JSON.parse(raw) as Partial<StoredCatalogIntent> | null;

    if (
      !stored ||
      stored.version !== STORAGE_VERSION ||
      typeof stored.savedAt !== 'number' ||
      !stored.intent ||
      // A clock set back past the save is as untrustworthy as an old save.
      now < stored.savedAt ||
      now - stored.savedAt > CATALOG_INTENT_TTL_MS
    ) {
      return null;
    }

    return toCatalogIntent(stored.intent);
  } catch {
    return null;
  }
}

export function clearCatalogIntent() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage cannot be reached.
  }
}

/**
 * What a sign-up sends so `account_created` is attributed to the catalog: the
 * model slug, and nothing when there is no intent.
 */
export function catalogIntentAttribution(intent: CatalogIntent | null): { catalogModel?: string } {
  return intent ? { catalogModel: intent.model } : {};
}

/**
 * Where to go once signed in: the add-vehicle form while an intent is waiting
 * for it, the dashboard otherwise. Shared by registration, sign-in and email
 * verification so each carries a visitor on to the vehicle they came for.
 */
export function afterSignInDestination(now: number = Date.now()): '/vehicles/new' | '/dashboard' {
  return readCatalogIntent(now) ? '/vehicles/new' : '/dashboard';
}
