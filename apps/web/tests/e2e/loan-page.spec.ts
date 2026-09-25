import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function post(page: Page, path: string, data: Record<string, unknown>) {
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

for (const viewport of VIEWPORTS) {
  test(`a loan has its own page, from Costs and the vehicle, at ${viewport.width}px`, async ({
    page,
  }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const nickname = `Loan Garage ${suffix.slice(-4)}`;
    const lender = 'HDFC Bank';

    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndSignIn(page, {
      name: `E2E Loan ${suffix}`,
      email: `e2e+loanpage${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname,
      odometer: '8500',
      registrationNumber: `MH12LP${suffix.slice(-4)}`,
    });
    const vehicleId = vehicleUrl.split('/').pop()!;
    const loan = await post(page, `vehicle-loans/vehicle/${vehicleId}`, {
      lender,
      principal: 150_000,
      interestRate: 9.5,
      tenureMonths: 36,
      startDate: daysFromNow(-150),
    });

    await page.setViewportSize(viewport);
    await page.goto('/costs');
    await page.getByTestId('loan-line').filter({ hasText: lender }).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/costs/loans/${loan.id}$`));

    // What is left, how far along, and the next EMI.
    await expect(page.getByRole('heading', { level: 1, name: lender })).toBeVisible();
    const hero = page.getByTestId('loan-hero');
    await expect(hero).toContainText('left');
    await expect(hero).toContainText(/% repaid · ends /);
    await expect(hero).toContainText('next EMI');

    // The balance, with today marked, and the EMI split on demand.
    const chart = page.getByTestId('loan-chart');
    await expect(chart.locator('[data-slot="chart"]')).toHaveAttribute(
      'data-marker',
      /\d{4}-\d{2}/,
    );
    await chart.getByRole('radio', { name: 'EMI split' }).click();
    await expect(chart.getByRole('heading', { name: 'What each EMI pays' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS) {
      await page.screenshot({
        path: `${SHOTS}/loan-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }

    // Prepay from the header: the form below takes it.
    await page.getByRole('button', { name: 'Prepay', exact: true }).click();
    await expect(page.getByLabel('Amount (₹)')).toBeFocused();
    await page.getByLabel('Amount (₹)').fill('10000');
    await page.getByRole('button', { name: 'Add prepayment' }).click();
    await expect(page.getByTestId('loan-prepayments')).toContainText('₹10,000');

    // The vehicle's own loans panel opens the same page.
    await page.goto(`${vehicleUrl}?tab=more&section=loans`);
    await page.getByRole('link', { name: 'Open' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/costs/loans/${loan.id}$`));
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
