import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
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

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

/**
 * #281: Costs gathers the garage's spend charts (moved from Home), per-vehicle
 * spend and cost per km, and the Loans page's whole body. Home is reduced to
 * one line linking here, and `/loans` still redirects here. Checked at both
 * phone and desktop widths, since the Spend charts and the by-vehicle list
 * lay out differently at each.
 */
test('Costs gathers spend, per-vehicle spend and loans; Home links to it; /loans redirects', async ({
  page,
}) => {
  test.slow();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const nickname = `Costs Garage ${suffix.slice(-4)}`;
  const lender = 'ICICI Bank Auto Loan';

  await page.setViewportSize(DESKTOP);
  await registerAndSignIn(page, {
    name: `E2E Costs ${suffix}`,
    email: `e2e+costs${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });

  // createCatalogVehicle needs a wide viewport; seed everything before
  // narrowing to a phone.
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '18500',
    registrationNumber: `MH12CO${suffix.slice(-4)}`,
  });
  const vehicleId = vehicleUrl.split('/').pop()!;

  // Spend: a fuel fill and a service, so the garage total, the trend chart,
  // and this vehicle's own lifetime spend all have something to show.
  await post(page, `fuel-logs/vehicle/${vehicleId}`, {
    date: daysFromNow(-20),
    odometer: 18700,
    quantity: 35,
    price: 105,
    totalCost: 3675,
  });
  await post(page, `vehicles/${vehicleId}/maintenance-records`, {
    category: 'periodic_service',
    serviceDate: daysFromNow(-40),
    odometer: 18300,
    totalCost: 4500,
  });

  // A loan, so both Home's one-line summary and the Loans section have an
  // outstanding balance to read.
  await post(page, `vehicle-loans/vehicle/${vehicleId}`, {
    lender,
    principal: 500_000,
    interestRate: 9,
    tenureMonths: 60,
    startDate: daysFromNow(-400),
  });

  for (const size of [DESKTOP, PHONE]) {
    await page.setViewportSize(size);
    const label = size === DESKTOP ? 'desktop (1440)' : 'phone (390)';

    // Home: one bordered line linking to Costs, not the old charts or loans card.
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    const summaryLink = page.getByRole('link', { name: /Loan outstanding/ });
    await expect(summaryLink, label).toBeVisible();
    await expect(summaryLink, label).toHaveAttribute('href', '/costs');
    await expect(page.getByText('Vehicle loans'), label).toHaveCount(0);
    await expect(page.getByText('Show spending'), label).toHaveCount(0);
    await expectNoSidewaysScroll(page, `Home at ${label}`);

    await summaryLink.click();
    await expect(page).toHaveURL(/\/costs$/);

    // Costs: the spend charts, this vehicle's own spend row, and loans.
    await expect(page.getByRole('heading', { level: 1, name: 'Costs' }), label).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spend', exact: true }), label).toBeVisible();
    await expect(
      page.getByRole('figure', { name: 'Spend each month, by category' }),
      label,
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By vehicle' }), label).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(nickname) }).first(),
      label,
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Loans' }), label).toBeVisible();
    // One line per loan (#311), with the total under them; the line opens the loan.
    const line = page.getByTestId('loan-line').filter({ hasText: lender });
    await expect(line, label).toContainText(`${nickname} · ${lender}`);
    await expect(line, label).toContainText(/left · ends /);
    await expect(page.getByTestId('loans-total'), label).toContainText('a month in EMIs');
    await expectNoSidewaysScroll(page, `Costs at ${label}`);
    if (process.env.E2E_SCREENSHOT_DIR) {
      await page.getByRole('heading', { name: 'Loans' }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${process.env.E2E_SCREENSHOT_DIR}/costs-${size.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    // The line opens the loan's own page (#312).
    await line.getByRole('link').click();
    await expect(page, label).toHaveURL(/\/costs\/loans\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1, name: lender }), label).toBeVisible();

    // The legacy address still lands here (kept by
    // routes/legacy-redirect-routes.tsx).
    await page.goto('/loans');
    await expect(page).toHaveURL(/\/costs$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Costs' }), label).toBeVisible();
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
