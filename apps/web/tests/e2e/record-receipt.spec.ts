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
  test(`a service record reads like a receipt, at ${viewport.width}px`, async ({ page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const nickname = `Receipt ${suffix.slice(-4)}`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndSignIn(page, {
      name: `E2E Receipt ${suffix}`,
      email: `e2e+receipt${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname,
      odometer: '17500',
      registrationNumber: `MH12RC${suffix.slice(-4)}`,
    });
    const vehicleId = vehicleUrl.split('/').pop()!;
    const record = await post(page, `vehicles/${vehicleId}/maintenance-records`, {
      category: 'engine_oil',
      serviceDate: new Date(Date.UTC(2026, 6, 25)).toISOString(),
      odometer: 17_500,
      workshopName: 'City Hyundai Service',
      totalCost: 3_750,
      laborCost: 1_535,
      taxCost: 640,
      notes: 'Topped up coolant too.',
      lineItems: [
        {
          kind: 'fluid',
          name: 'Engine oil 5W-30',
          quantity: 3.5,
          unit: 'L',
          unitPrice: 450,
          lineTotal: 1_575,
        },
      ],
    });

    await page.setViewportSize(viewport);
    await page.goto(`/maintenance-records/${record.id}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Engine oil' })).toBeVisible();
    await expect(page.getByTestId('receipt-total')).toHaveText('₹3,750');
    await expect(page.getByText('25 Jul 2026 · 17,500 km · City Hyundai Service')).toBeVisible();
    const items = page.getByRole('table', { name: 'Items' });
    await expect(items).toContainText('Engine oil 5W-30');
    await expect(items).toContainText('Labour');
    await expect(items).toContainText('Tax');
    await expect(page.getByText('Topped up coolant too.')).toBeVisible();
    await expect(page.getByTestId('receipt-provenance')).toContainText('Typed in on');
    // The breadcrumb is the way back now.
    await expect(page.getByRole('link', { name: 'Back to History' })).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS) {
      await page.screenshot({
        path: `${SHOTS}/receipt-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
