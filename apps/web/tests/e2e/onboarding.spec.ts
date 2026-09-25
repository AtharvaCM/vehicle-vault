import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';
import { selectDropdownOption, selectSearchableOption } from './helpers/vehicle-form';

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
      path: `${SHOTS}/onboarding-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #346: a new account registers straight into adding its vehicle, then its
 * papers, then the suggested service schedule, and lands on Home, where a
 * setup checklist carries it to its first reminder: one title, no day-one
 * toast and no amber banner. An empty garage looks the same on Home and
 * Garage.
 */
for (const viewport of VIEWPORTS) {
  test(`a new account goes register → vehicle → papers → schedule → Home, at ${viewport.width}px`, async ({
    page,
  }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.setViewportSize(viewport);
    await page.goto('/register');
    await page.getByLabel(/^your name$/i).fill(`Asha ${suffix}`);
    await page.getByLabel(/email address/i).fill(`e2e+onboarding${suffix}@vehiclevault.dev`);
    await page.getByLabel(/^password$/i).fill('VehicleVault!234');
    await page.getByRole('button', { name: /create account/i }).click();

    // Straight on to the vehicle, with no toast to say an account exists.
    await expect(page).toHaveURL(/\/vehicles\/new$/);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);

    // Home before the vehicle: a welcome, the checklist, the empty garage, no banner.
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome, Asha');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const checklist = page.getByTestId('setup-checklist');
    await expect(checklist).toContainText('1 of 5 done');
    await expect(checklist).toContainText(/Verify your email · \d+ days left/);
    await expect(checklist.getByRole('button', { name: 'Resend' })).toBeVisible();
    await expect(page.getByTestId('empty-garage')).toContainText('What you’ll see');
    await expect(page.getByText(/^Verify your email —/)).toHaveCount(0);
    await expectNoSidewaysScroll(page, `first-run Home at ${viewport.width}px`);
    await shoot(page, 'home-empty', viewport.width);

    // The same empty garage on Garage, with its own Add your vehicle.
    await page.goto('/vehicles');
    const empty = page.getByTestId('empty-garage');
    await expect(empty.getByRole('link', { name: 'Add your vehicle' })).toHaveAttribute(
      'href',
      '/vehicles/new',
    );
    await expect(empty).toContainText('Have an invite? Open the link from your email.');
    await shoot(page, 'garage-empty', viewport.width);

    // Add the vehicle (the catalog pickers want room), then papers, then schedule.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/home');
    await checklist.getByRole('link', { name: 'Add vehicle' }).click();
    await expect(page).toHaveURL(/\/vehicles\/new$/);
    await page.getByLabel(/registration number/i).fill(`MH12ON${suffix.slice(-4)}`);
    await selectDropdownOption(page, /^vehicle type$/i, 'SUV');
    await page.getByLabel(/^year$/i).fill('2024');
    await page.getByLabel(/^year$/i).press('Tab');
    await selectSearchableOption(page, 'vehicle-make', 'Search makes...', 'Hyundai', 'Hyundai');
    await selectSearchableOption(page, 'vehicle-model', 'Search models...', 'Creta', 'Creta');
    await selectSearchableOption(page, 'vehicle-variant', 'Search variants...', 'SX', 'SX');
    await page.getByLabel('Odometer', { exact: true }).fill('15200');
    await page.getByRole('button', { name: /save vehicle/i }).click();

    await page.setViewportSize(viewport);
    const steps = page.getByRole('list', { name: 'Steps' });
    await expect(steps.locator('[aria-current="step"]')).toHaveText(/Papers/);
    const inAYear = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel('Insurance expires on').fill(inAYear);
    await page.getByLabel('PUC expires on').fill(inAYear);
    await shoot(page, 'papers', viewport.width);
    await page.getByRole('button', { name: 'Save dates' }).click();

    await expect(steps.locator('[aria-current="step"]')).toHaveText(/Service schedule/);
    await expect(page.getByText('Suggested service schedule')).toBeVisible();
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await expectNoSidewaysScroll(page, `schedule step at ${viewport.width}px`);
    await shoot(page, 'schedule', viewport.width);
    await page.getByRole('button', { name: 'Go to Home' }).click();

    // Home: its own title again, and the checklist moved on.
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    const finish = page.getByRole('region', { name: 'Finish setting up' });
    await expect(finish).toContainText('3 of 5 done');
    await expect(finish.getByRole('link', { name: 'Log service' })).toBeVisible();
    await expectNoSidewaysScroll(page, `Home in setup at ${viewport.width}px`);
    await shoot(page, 'home-setup', viewport.width);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
