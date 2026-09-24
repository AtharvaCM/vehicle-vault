import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * This month and the one before, on the Indian calendar the page groups by:
 * the odometer reading below is taken now, so the seeded rows must share its
 * month whenever the suite runs.
 */
const nowInIndia = new Date(Date.now() + 330 * 60 * 1000);
const THIS_MONTH = { year: nowInIndia.getUTCFullYear(), month: nowInIndia.getUTCMonth() };
const LAST_MONTH =
  THIS_MONTH.month === 0
    ? { year: THIS_MONTH.year - 1, month: 11 }
    : { year: THIS_MONTH.year, month: THIS_MONTH.month - 1 };
const THIS_MONTH_LABEL = `${MONTHS[THIS_MONTH.month]} ${THIS_MONTH.year}`;
const LAST_MONTH_LABEL = `${MONTHS[LAST_MONTH.month]} ${LAST_MONTH.year}`;

/** UTC midnight on a day of this month, as a date-only field is stored. */
function thisMonthDay(day: number) {
  return new Date(Date.UTC(THIS_MONTH.year, THIS_MONTH.month, day));
}

function lastMonthDay(day: number) {
  return new Date(Date.UTC(LAST_MONTH.year, LAST_MONTH.month, day));
}

async function authToken(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
}

/** Bumps the odometer through the real API, the same path the dashboard card uses. */
async function patchOdometer(page: Page, vehicleId: string, odometer: number) {
  const response = await page.request.patch(`/api/vehicles/${vehicleId}/odometer`, {
    data: { odometer },
    headers: { Authorization: `Bearer ${await authToken(page)}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

function checkNoHorizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

test('the garage-wide history timeline: grouped, totalled, filterable and responsive', async ({
  page,
}) => {
  test.slow();
  const suffix = uniqueSuffix();
  const dailyNickname = `History Daily ${suffix.slice(-4)}`;
  const weekendNickname = `History Weekend ${suffix.slice(-4)}`;

  await page.setViewportSize(DESKTOP);
  await registerAndSignIn(page, {
    name: `E2E History ${suffix}`,
    email: `e2e+history${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname: dailyNickname,
    odometer: '10000',
    registrationNumber: `MH12HD${suffix.slice(-4)}`,
  });
  await page.goto('/garage');
  await createCatalogVehicle(page, {
    nickname: weekendNickname,
    odometer: '5000',
    registrationNumber: `MH12HW${suffix.slice(-4)}`,
  });

  const daily = await prisma.vehicle.findFirstOrThrow({ where: { nickname: dailyNickname } });
  const weekend = await prisma.vehicle.findFirstOrThrow({ where: { nickname: weekendNickname } });

  // A confirmed service and a draft, both this month, on the daily.
  await prisma.maintenanceRecord.create({
    data: {
      vehicleId: daily.id,
      serviceDate: thisMonthDay(20),
      odometer: 10_200,
      category: 'engine_oil',
      workshopName: 'Torque Garage',
      totalCost: 4_200,
      status: 'confirmed',
    },
  });
  await prisma.maintenanceRecord.create({
    data: {
      vehicleId: daily.id,
      serviceDate: thisMonthDay(18),
      odometer: 10_150,
      category: 'periodic_service',
      workshopName: 'Highway Service Point',
      totalCost: 9_999,
      status: 'draft',
    },
  });

  // A fuel fill this month, on the weekend vehicle.
  await prisma.fuelLog.create({
    data: {
      vehicleId: weekend.id,
      date: thisMonthDay(15),
      odometer: 5_100,
      quantity: 25,
      price: 120,
      totalCost: 3_000,
    },
  });

  // An older, confirmed service the month before, left out of this month's total.
  await prisma.maintenanceRecord.create({
    data: {
      vehicleId: daily.id,
      serviceDate: lastMonthDay(5),
      odometer: 9_800,
      category: 'tyre_rotation',
      workshopName: 'August Motors',
      totalCost: 1_800,
      status: 'confirmed',
    },
  });

  // One odometer reading, through the real API: now, so it lands in this month.
  await patchOdometer(page, daily.id, 10_400);

  await page.goto('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();

  const monthHeadings = page.getByRole('main').locator('h2');
  await expect(monthHeadings).toHaveText([THIS_MONTH_LABEL, LAST_MONTH_LABEL]);

  const thisMonth = page.getByTestId('history-month').filter({ hasText: THIS_MONTH_LABEL });
  await expect(thisMonth.getByTestId('history-month-total')).toContainText('₹7,200');
  await expect(thisMonth.getByTestId('history-month-total')).toContainText('1 draft not counted');
  await expect(thisMonth.getByRole('link', { name: 'Review and confirm' })).toBeVisible();
  await expect(thisMonth.locator('[data-kind="odometer"]')).toBeVisible();

  // Plates: a two-vehicle garage shows the registration on every row.
  await expect(page.locator('[data-slot="number-plate"]').first()).toBeVisible();

  // Filter by kind: Fuel.
  await page.getByRole('radio', { name: 'Fuel' }).click();
  await expect(page).toHaveURL(/[?&]kind=fuel(&|$)/);
  const rows = page.getByTestId('history-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-kind', 'fuel');

  // Filter by vehicle instead (kind back to All, on the way there).
  await page.getByRole('radio', { name: 'All' }).click();
  await page.getByRole('combobox', { name: 'Vehicle' }).click();
  await page.getByRole('option', { name: new RegExp(dailyNickname) }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]vehicle=${daily.id}(&|$)`));
  for (const row of await page.getByTestId('history-row').all()) {
    await expect(row).not.toHaveAttribute('data-kind', 'fuel');
  }

  // Reload: the vehicle filter survives.
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`[?&]vehicle=${daily.id}(&|$)`));
  await expect(page.getByRole('combobox', { name: 'Vehicle' })).toContainText(dailyNickname);

  // The old maintenance list's category filter has no home on History: the
  // redirect keeps the query, and the page ignores it and shows everything.
  await page.goto('/maintenance?category=engine_oil');
  await expect(page).toHaveURL(/\/history\?category=engine_oil$/);
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await expect(page.getByTestId('history-row').filter({ hasText: 'Fuel,' })).not.toHaveCount(0);

  // The same core story, narrow: grouped, totalled, no sideways scroll.
  await page.setViewportSize(PHONE);
  await page.goto('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await expect(page.getByRole('main').locator('h2')).toHaveText([
    THIS_MONTH_LABEL,
    LAST_MONTH_LABEL,
  ]);
  const thisMonthPhone = page.getByTestId('history-month').filter({ hasText: THIS_MONTH_LABEL });
  await expect(thisMonthPhone.getByTestId('history-month-total')).toContainText('₹7,200');
  await expect(thisMonthPhone.getByTestId('history-month-total')).toContainText(
    '1 draft not counted',
  );
  await expect(thisMonthPhone.getByRole('link', { name: 'Review and confirm' })).toBeVisible();
  const overflow = await checkNoHorizontalOverflow(page);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

  await page.getByRole('radio', { name: 'Fuel' }).click();
  await expect(page).toHaveURL(/[?&]kind=fuel(&|$)/);
  await expect(page.getByTestId('history-row')).toHaveCount(1);
  const overflowFiltered = await checkNoHorizontalOverflow(page);
  expect(overflowFiltered.scrollWidth).toBeLessThanOrEqual(overflowFiltered.innerWidth);
});

test('older entries page in once there are more than a page of fuel fills', async ({ page }) => {
  test.slow();
  const suffix = uniqueSuffix();
  const nickname = `History Paging ${suffix.slice(-4)}`;

  await page.setViewportSize(DESKTOP);
  await registerAndSignIn(page, {
    name: `E2E History Paging ${suffix}`,
    email: `e2e+historypaging${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '20000',
    registrationNumber: `MH12HP${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  // 35 fills: one page (30, the API default limit) plus a second to load.
  await prisma.fuelLog.createMany({
    data: Array.from({ length: 35 }, (_, index) => ({
      vehicleId: vehicle.id,
      date: thisMonthDay(1 + (index % 28)),
      odometer: 20_000 + index * 10,
      quantity: 20,
      price: 100,
      totalCost: 2_000,
    })),
  });

  await page.goto('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  const initialRows = await page.getByTestId('history-row').count();
  expect(initialRows).toBeGreaterThan(0);
  expect(initialRows).toBeLessThan(35);

  const showOlder = page.getByRole('button', { name: 'Show older entries' });
  await expect(showOlder).toBeVisible();
  await showOlder.click();

  await expect(page.getByTestId('history-row')).toHaveCount(35);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
