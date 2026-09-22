import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 1024, height: 768 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function signIn(page: Page, label: string) {
  const suffix = uniqueSuffix();
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+${label.toLowerCase()}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  return suffix;
}

/**
 * The shell was a desktop layout squeezed onto a phone. Below md the primary
 * navigation moves to a bottom bar; from md up nothing changes. jsdom cannot
 * evaluate a breakpoint, so the widths are checked here, in a real browser.
 */
test('a phone gets the bottom bar instead of the menu button', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, 'Phone');

  const bar = page.getByRole('navigation', { name: 'Primary' });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();

  // The page leaves room for the bar, so it never covers the last row.
  const room = await page.evaluate(() => {
    const main = document.getElementById('main-content');
    const nav = document.querySelector('[data-testid="bottom-nav"]');
    return {
      padding: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0,
      bar: nav ? nav.getBoundingClientRect().height : Infinity,
    };
  });
  expect(room.padding).toBeGreaterThanOrEqual(room.bar);

  await bar.getByRole('link', { name: 'Vehicles' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);
  // Where you are reads at a glance: the current destination is coloured apart.
  const vehicles = bar.getByRole('link', { name: 'Vehicles' });
  await expect(vehicles).toHaveAttribute('data-status', 'active');
  const colourOf = (name: string) =>
    bar.getByRole('link', { name }).evaluate((node) => getComputedStyle(node).color);
  expect(await colourOf('Vehicles')).not.toBe(await colourOf('Dashboard'));

  // Everything that does not fit on the bar is one tap away.
  await bar.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: /loans/i })).toBeVisible();
});

test('from md up the layout is unchanged', async ({ page }) => {
  await page.setViewportSize(TABLET);
  await signIn(page, 'Tablet');

  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
});

test('the vehicle tabs scroll on a phone, with a linked tab brought into view', async ({
  page,
}) => {
  const suffix = await signIn(page, 'Tabs');
  await createCatalogVehicle(page, {
    nickname: `Tabs Garage ${suffix.slice(-4)}`,
    odometer: '15200',
    registrationNumber: `MH12TB${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();

  await page.setViewportSize(PHONE);
  // Activity is the last of the tabs: far off the right edge of a phone.
  await page.goto(`${vehicleUrl}?tab=activity`);

  const activity = page.getByRole('tab', { name: 'Activity' });
  await expect(activity).toHaveAttribute('data-state', 'active');
  const box = await activity.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);

  // The strip scrolls rather than clipping or pushing the page sideways.
  const strip = page.getByRole('tablist');
  expect(await strip.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  // Measured on Overview: the Activity feed's own rows overflow a phone, which is
  // content inside a tab rather than the strip, and is tracked separately.
  await page.goto(`${vehicleUrl}?tab=overview`);
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    PHONE.width,
  );
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
