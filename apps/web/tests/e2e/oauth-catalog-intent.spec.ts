import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/**
 * A catalog intent through Google or GitHub sign-in.
 *
 * Real providers cannot run here. What does:
 * - The web side of the callback: the API hands tokens to
 *   `/auth/oauth-callback` in the URL fragment, so these tests arrive there the
 *   same way, with tokens for a real account on the local API.
 * - When the API has Google configured (any client id; CI sets a fake one),
 *   the real begin redirect and the real API callback, with this test standing
 *   in for Google's answer: cancelled, a forged state, or a genuine state in
 *   another browser. A successful code exchange would need Google, so that leg
 *   (and `account_created` for an OAuth account) is covered by the API's unit
 *   tests instead.
 */

const STORAGE_KEY = 'vehicle-vault.catalog-intent';

type SeededVariant = {
  path: string;
  makeName: string;
  modelName: string;
  modelSlug: string;
  variantName: string;
};

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function seededCarVariant(): Promise<SeededVariant> {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: { fuelTypes: { has: 'petrol' } } },
      generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } },
    },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  const { model } = generation;

  return {
    path: `/cars/${model.make.slug}/${model.slug}/${generation.slug}/${variant.slug}`,
    makeName: model.make.name,
    modelName: model.name,
    modelSlug: model.slug,
    variantName: variant.name,
  };
}

/** An account on the local API, and the token pair the OAuth callback would carry. */
async function accountTokens(request: APIRequestContext, tag: string) {
  const suffix = uniqueSuffix();
  const response = await request.post('/api/auth/register', {
    data: {
      name: `E2E OAuth ${suffix}`,
      email: `e2e+oauth-${tag}${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    data: { accessToken: string; refreshToken: string; user: { email: string } };
  };
  return { ...body.data, password: 'VehicleVault!234' };
}

async function pressTrackThisVehicle(page: Page, variant: SeededVariant) {
  await page.goto(variant.path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Track this vehicle' }).click();
  await expect(page).toHaveURL(/\/register$/);
}

async function storedIntent(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
}

async function expectPrefilled(page: Page, variant: SeededVariant) {
  await expect(page).toHaveURL(/\/vehicles\/new$/);
  await expect(page.locator('#vehicle-make')).toContainText(variant.makeName);
  await expect(page.locator('#vehicle-model')).toContainText(variant.modelName);
  await expect(page.locator('#vehicle-variant')).toContainText(variant.variantName);
}

async function googleConfigured(request: APIRequestContext) {
  const response = await request.get('/api/auth/oauth/providers');
  const body = (await response.json()) as { data?: { providers?: string[] } };
  return body.data?.providers?.includes('google') ?? false;
}

test.describe('Catalog intent through OAuth sign-in', () => {
  let variant: SeededVariant;

  test.beforeAll(async () => {
    variant = await seededCarVariant();
  });

  test('the callback carries a visitor from Track this vehicle on to the prefilled form', async ({
    page,
  }) => {
    const tokens = await accountTokens(page.request, 'ok');

    await pressTrackThisVehicle(page, variant);
    expect(await storedIntent(page)).not.toBeNull();

    // What the API's callback redirect delivers after the provider says yes.
    await page.goto(
      `/auth/oauth-callback#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );

    await expectPrefilled(page, variant);
    // The form used the intent up; the callback page did not need to.
    expect(await storedIntent(page)).toBeNull();
    expect(page.url()).not.toContain('accessToken');
  });

  test('a cancelled sign-in keeps the intent, and the retry lands on the prefilled form', async ({
    page,
  }) => {
    const tokens = await accountTokens(page.request, 'retry');

    await pressTrackThisVehicle(page, variant);
    await page.goto('/auth/oauth-callback#error=oauth_cancelled');

    await expect(page.getByText('Sign-in was cancelled before it finished.')).toBeVisible();
    expect(await storedIntent(page)).not.toBeNull();

    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/email address/i).fill(tokens.user.email);
    await page.getByLabel(/^password$/i).fill(tokens.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expectPrefilled(page, variant);
  });

  test.describe('through the API, with the test answering for Google', () => {
    test.beforeEach(async ({ request }) => {
      test.skip(
        !(await googleConfigured(request)),
        'Needs GOOGLE_OAUTH_CLIENT_ID, _SECRET and _CALLBACK_URL on the API (any values).',
      );
    });

    /**
     * Begins Google sign-in at the address the button links to, and returns
     * where the API sends the browser. `page.request` shares the browser's
     * cookies, so the state cookie lands where the callback looks for it.
     * (A click would follow the redirect on to Google, which Playwright cannot
     * route: a route handler sees only the first request of a redirect chain.)
     */
    async function beginGoogleSignIn(page: Page) {
      const link = page.getByRole('link', { name: 'Continue with Google' });
      await expect(link).toHaveAttribute(
        'href',
        `/api/auth/oauth/google?catalogModel=${variant.modelSlug}`,
      );
      const response = await page.request.get((await link.getAttribute('href')) ?? '', {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(302);
      const authorize = new URL(response.headers()['location'] ?? '');
      expect(authorize.origin).toBe('https://accounts.google.com');

      const state = authorize.searchParams.get('state') ?? '';
      const [body, signature] = state.split('.');
      return {
        callback: new URL(authorize.searchParams.get('redirect_uri') ?? ''),
        state,
        payload: JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8')) as Record<
          string,
          unknown
        >,
        signature: signature ?? '',
      };
    }

    /** Google's redirect back to the API's callback. */
    function googleAnswers(callback: URL, query: Record<string, string>) {
      const url = new URL(callback);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
      return url.toString();
    }

    test('the model rides in the signed state, and a cancel comes back with the intent kept', async ({
      page,
    }) => {
      await pressTrackThisVehicle(page, variant);

      const started = await beginGoogleSignIn(page);
      expect(started.payload).toMatchObject({ p: 'google', m: variant.modelSlug });

      await page.goto(
        googleAnswers(started.callback, { error: 'access_denied', state: started.state }),
      );

      await expect(page).toHaveURL(/\/auth\/oauth-callback$/);
      await expect(page.getByText('Sign-in was cancelled before it finished.')).toBeVisible();
      expect(await storedIntent(page)).not.toBeNull();
    });

    test('a callback with a forged model is refused before any code is exchanged', async ({
      page,
    }) => {
      await pressTrackThisVehicle(page, variant);

      const started = await beginGoogleSignIn(page);
      const forged = Buffer.from(
        JSON.stringify({ ...started.payload, m: 'forged-model' }),
      ).toString('base64url');

      await page.goto(
        googleAnswers(started.callback, {
          code: 'not-a-real-code',
          state: `${forged}.${started.signature}`,
        }),
      );

      // Refused on the state: a code exchange would have failed differently.
      await expect(page).toHaveURL(/\/auth\/oauth-callback$/);
      await expect(page.getByText(/started in another browser/)).toBeVisible();
      expect(await storedIntent(page)).not.toBeNull();
    });

    test('a genuine state opened in another browser is refused (login CSRF)', async ({
      page,
      browser,
    }) => {
      await pressTrackThisVehicle(page, variant);
      const started = await beginGoogleSignIn(page);

      const elsewhere = await browser.newContext();
      const victim = await elsewhere.newPage();
      await victim.goto(
        googleAnswers(started.callback, { code: 'not-a-real-code', state: started.state }),
      );

      await expect(victim).toHaveURL(/\/auth\/oauth-callback$/);
      await expect(victim.getByText(/started in another browser/)).toBeVisible();
      await elsewhere.close();
    });
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
