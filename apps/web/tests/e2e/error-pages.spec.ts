import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/errors-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #365: every error and not-found page says what happened once and leads
 * somewhere: the public 404 home and to the catalog, a vehicle that isn't
 * yours back to the garage, and a Google sign-in that didn't finish back to
 * Google or to email, in the public frame and in plain words.
 */
for (const viewport of VIEWPORTS) {
  test(`error and not-found pages lead somewhere, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    // The public 404.
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    const card = page.getByTestId('auth-card');
    await expect(card.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
      'href',
      '/',
    );
    await expect(card.getByRole('link', { name: 'Browse cars' })).toHaveAttribute('href', '/cars');
    await expect(card.getByRole('link', { name: 'Browse bikes' })).toHaveAttribute(
      'href',
      '/bikes',
    );
    await shoot(page, 'not-found', viewport.width);

    // Google sent the visitor back with "access_denied": they pressed Cancel.
    await page.goto('/auth/oauth-callback#error=access_denied');
    await expect(page.getByRole('link', { name: 'Vehicle Vault home' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign-in didn’t finish');
    await expect(page.getByText('You cancelled signing in with Google.')).toBeVisible();
    await expect(page.getByText(/OAuth/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Sign in with email' })).toHaveAttribute(
      'href',
      '/login',
    );
    await shoot(page, 'oauth', viewport.width);

    // Signed in: a vehicle that isn't in this garage, said once, with the way back.
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerAndSignIn(page, {
      name: `E2E Errors ${suffix}`,
      email: `e2e+errors${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    await page.goto('/vehicles/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { level: 1, name: 'Vehicle not found' })).toBeVisible();
    await expect(page.getByText('Vehicle not found', { exact: true })).toHaveCount(1);
    await expect(page.getByText("This vehicle isn't in your garage.")).toBeVisible();
    await expect(
      page.getByTestId('resource-load-error').getByRole('link', { name: 'Your garage' }),
    ).toHaveAttribute('href', '/garage');
    await shoot(page, 'vehicle-not-found', viewport.width);
  });
}
