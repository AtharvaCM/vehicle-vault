import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/auth-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/** Both providers configured on the API: the page offers Google alone. */
async function offerBothProviders(page: Page) {
  await page.route('**/api/auth/oauth/providers', (route) =>
    route.fulfill({ json: { success: true, data: { providers: ['google', 'github'] } } }),
  );
}

/** One card with one title, the form's submit button on screen without scrolling. */
async function expectOneCard(page: Page, title: string, submit: string, viewportHeight: number) {
  await expect(page.getByTestId('auth-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  const box = await page.getByRole('button', { name: submit, exact: true }).boundingBox();
  expect(box, `${submit} is on the page`).not.toBeNull();
  expect(box!.y + box!.height, `${submit} sits above the fold`).toBeLessThanOrEqual(viewportHeight);
}

/**
 * #343: sign-in, register, forgot and reset password are one centred card on
 * every width. Google comes first and GitHub is not offered; every password
 * field shows and hides; a failure says so once; a return path and a catalog
 * vehicle say why the visitor is signing in.
 */
for (const viewport of VIEWPORTS) {
  test(`sign-in and register are one card with Google first, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await offerBothProviders(page);

    // Sign in: Google, then "or", then email; no GitHub.
    await page.goto('/login');
    await expectOneCard(page, 'Sign in', 'Sign in', viewport.height);
    const card = page.getByTestId('auth-card');
    await expect(card.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('link', { name: /github/i })).toHaveCount(0);
    const google = await card.getByRole('link', { name: 'Continue with Google' }).boundingBox();
    const email = await page.getByLabel(/email address/i).boundingBox();
    expect(google!.y).toBeLessThan(email!.y);
    await expectNoSidewaysScroll(page, 'sign in');
    await shoot(page, 'sign-in', viewport.width);

    // The password shows and hides.
    const password = page.getByLabel(/^password$/i);
    await password.fill('not-the-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'password');

    // A wrong password says so once: under the form, not in a toast as well.
    await page.getByLabel(/email address/i).fill(`e2e+nobody${Date.now()}@vehiclevault.dev`);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(card.getByText('Invalid email or password.')).toBeVisible();
    await expect(page.getByText('Invalid email or password.')).toHaveCount(1);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await shoot(page, 'sign-in-error', viewport.width);

    // Register: one card, the same Google button, the length rule as you type.
    await page.goto('/register');
    await expectOneCard(page, 'Create your free account', 'Create account', viewport.height);
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('link', { name: /github/i })).toHaveCount(0);
    const rule = page.getByText('At least 8 characters');
    await page.getByLabel(/^password$/i).fill('short');
    await expect(rule).not.toHaveAttribute('data-met');
    await page.getByLabel(/^password$/i).fill('long enough');
    await expect(rule).toHaveAttribute('data-met', 'true');
    await expectNoSidewaysScroll(page, 'register');
    await shoot(page, 'register', viewport.width);

    // Forgot and reset password are the same card.
    await page.goto('/forgot-password');
    await expect(page.getByTestId('auth-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await page.goto('/reset-password?token=not-a-real-token');
    await expect(page.getByTestId('auth-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel(/^new password$/i)).toHaveAttribute('type', 'password');
    await expect(page.getByLabel(/confirm new password/i)).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveCount(2);
    await shoot(page, 'reset-password', viewport.width);
  });

  test(`a return path and a catalog vehicle say why, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    await page.goto('/login?next=%2Fvehicle-invites%2Fabc123');
    await expect(page.getByTestId('auth-card')).toContainText(
      'Sign in to accept your vehicle invite.',
    );
    await shoot(page, 'sign-in-next', viewport.width);

    // Track this vehicle from a variant page: register names it at the top.
    const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
      where: { generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } } },
      include: { generation: { include: { model: { include: { make: true } } } } },
      orderBy: { slug: 'asc' },
    });
    const { generation } = variant;
    const { model } = generation;
    await page.goto(`/cars/${model.make.slug}/${model.slug}/${generation.slug}/${variant.slug}`);
    await page.getByRole('link', { name: 'Track this vehicle' }).click();
    await expect(page).toHaveURL(/\/register$/);
    const intent = page.getByTestId('catalog-intent-card');
    await expect(intent).toContainText(`${model.make.name} ${model.name} · ${variant.name}`);
    // Above the title: the reason comes first.
    const intentBox = await intent.boundingBox();
    const titleBox = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(intentBox!.y).toBeLessThan(titleBox!.y);
    await expectNoSidewaysScroll(page, 'register with a catalog vehicle');
    await shoot(page, 'register-intent', viewport.width);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
