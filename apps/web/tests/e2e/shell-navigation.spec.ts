import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 1024, height: 768 };
const DESKTOP = { width: 1440, height: 900 };

/** Each top-level destination, where it lives, and the H1 it opens on. */
const DESTINATIONS: Array<[label: string, path: string, heading: string]> = [
  ['Home', '/home', 'Home'],
  ['Garage', '/garage', 'Garage'],
  ['Upcoming', '/upcoming', 'Upcoming'],
  ['History', '/history', 'History'],
  ['Costs', '/costs', 'Costs'],
];

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

/** Seeds through the API as the signed-in user: far quicker than the forms. */
async function post(page: Page, path: string, data: object) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api/${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `POST ${path}: ${await response.text()}`).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

function breadcrumbTrail(page: Page) {
  return page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('listitem');
}

test('every top-level page is one click away, and a deep page says where it sits', async ({
  page,
}) => {
  test.slow();
  const suffix = await signIn(page, 'Shell');
  const nickname = `Shell SUV ${suffix.slice(-4)}`;
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber: `MH12SH${suffix.slice(-4)}`,
  });
  const vehicleId = vehicleUrl.split('/').pop()!;
  const record = await post(page, `vehicles/${vehicleId}/maintenance-records`, {
    category: 'periodic_service',
    serviceDate: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    odometer: 14800,
    workshopName: 'Shell Test Workshop',
    totalCost: 4200,
  });

  for (const size of [DESKTOP, TABLET]) {
    await page.setViewportSize(size);
    await page.goto('/home');
    const sidebar = page.getByTestId('sidebar');
    const nav = sidebar.getByRole('navigation', { name: 'Primary' });
    await expect(page.getByTestId('bottom-nav')).toBeHidden();

    // One navigation: five destinations, no Settings, no menu button or chip row.
    await expect(nav.getByRole('link')).toHaveText(DESTINATIONS.map(([label]) => label));
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);

    for (const [label, path, heading] of DESTINATIONS) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('data-active', 'true');
      // The topbar never repeats the page's title.
      await expect(page.getByRole('banner').getByRole('heading')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(1);
    }

    // A service record sits under its vehicle's History tab, and lights Garage.
    await page.goto(`/maintenance-records/${record.id}`);
    await expect(breadcrumbTrail(page)).toHaveText([
      'Garage',
      nickname,
      'History',
      'Service record',
    ]);
    await expect(nav.getByRole('link', { name: 'Garage' })).toHaveAttribute('data-active', 'true');
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: nickname })
      .click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}$`));
    await expect(breadcrumbTrail(page)).toHaveText(['Garage', nickname]);

    // The account menu: from the sidebar's foot at xl, from the topbar below it.
    const account = page.getByRole('button', { name: /^Account menu for / });
    await expect(account).toHaveCount(1);
    await expect(
      size === DESKTOP ? sidebar.getByRole('button', { name: /^Account menu for / }) : account,
    ).toBeVisible();
    await account.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Notification preferences' })).toBeVisible();
    await expect(menu.getByRole('menuitemradio', { name: 'Dark' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  }

  await page.setViewportSize(PHONE);
  await page.goto('/home');
  const bar = page.getByTestId('bottom-nav');
  await expect(page.getByTestId('sidebar')).toBeHidden();
  // Home · Garage · ＋ · Upcoming · More; History and Costs are under More.
  const onBar = DESTINATIONS.filter(([label]) => ['Home', 'Garage', 'Upcoming'].includes(label));
  for (const [label, path, heading] of onBar) {
    await bar.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  for (const [label, path, heading] of DESTINATIONS.filter(([name]) =>
    ['History', 'Costs'].includes(name),
  )) {
    await bar.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'More' })).toHaveAttribute('data-active', 'true');
  }

  // On a phone the trail shortens to the way back: the vehicle's History tab.
  await page.goto(`/maintenance-records/${record.id}`);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeHidden();
  await page.getByRole('banner').getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}\\?tab=history$`));
  await expect(bar.getByRole('link', { name: 'Garage' })).toHaveAttribute('data-active', 'true');
});

test('old addresses land on the new pages, query string and all', async ({ page }) => {
  await signIn(page, 'Redirects');

  const moves: Array<[from: string, to: RegExp, heading: string]> = [
    ['/dashboard?focus=overdue', /\/home\?focus=overdue$/, 'Home'],
    ['/vehicles?sort=year-desc', /\/garage\?sort=year-desc$/, 'Garage'],
    ['/reminders?status=overdue', /\/upcoming\?status=overdue$/, 'Upcoming'],
    ['/maintenance?search=oil', /\/history\?search=oil$/, 'History'],
    ['/loans', /\/costs$/, 'Costs'],
  ];
  for (const [from, to, heading] of moves) {
    await page.goto(from);
    await expect(page).toHaveURL(to);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }

  // The redirect replaces the old entry: Back leaves, it does not bounce.
  await page.goto('/settings');
  await page.goto('/vehicles');
  await expect(page).toHaveURL(/\/garage$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
