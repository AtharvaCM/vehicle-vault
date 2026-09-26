import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

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

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/papers-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #368: the Papers view asks for the RC like any other paper, speaks one
 * status vocabulary (Valid, Ends soon, Expired), lays every card across its
 * width with each value labelled and no raw enum values, and, with no
 * scanner configured, offers no scan and never mentions keys or config files.
 */
for (const viewport of VIEWPORTS) {
  test(`the Papers view, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = suffix.slice(-4);
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Papers ${suffix}`,
      email: `e2e+papersview${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12PV${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 18000,
      nickname: `Family ${digits}`,
    });
    await prisma.insurancePolicy.create({
      data: {
        vehicleId: vehicle.id,
        provider: 'Acme General',
        policyNumber: `OG-${digits}`,
        startDate: daysFromNow(-355),
        endDate: daysFromNow(10),
      },
    });
    // Written the way a scan or an import writes it.
    await prisma.warranty.create({
      data: {
        vehicleId: vehicle.id,
        provider: 'Hyundai',
        type: 'manufacturer',
        startDate: daysFromNow(-300),
        endDate: daysFromNow(800),
        endOdometer: 100000,
      },
    });
    await prisma.complianceDocument.create({
      data: {
        vehicleId: vehicle.id,
        kind: 'puc',
        provider: 'PUC Centre Baner',
        startDate: daysFromNow(-20),
        endDate: daysFromNow(160),
      },
    });

    await page.goto(`/vehicles/${vehicle.id}?tab=papers`);
    const main = page.getByRole('main');
    const cards = main.getByTestId('document-card');
    await expect(cards).toHaveCount(3);

    // One vocabulary.
    await expect(cards.filter({ hasText: 'Acme General' })).toContainText('Ends soon');
    await expect(cards.filter({ hasText: 'PUC Centre Baner' })).toContainText('Valid');
    await expect(main.getByText(/^(Active|In force|Expiring soon|No expiry)$/)).toHaveCount(0);

    // Words, not raw values; every value under a label.
    const warranty = cards.filter({ hasText: 'Hyundai' });
    await expect(warranty).toContainText('Manufacturer warranty');
    await expect(warranty.getByText('manufacturer', { exact: true })).toHaveCount(0);
    await expect(warranty).toContainText('Covered up to');
    await expect(warranty).toContainText('1,00,000 km');

    // No empty half-panels: each card's facts run across its width.
    for (const card of await cards.all()) {
      const cardBox = (await card.boundingBox())!;
      const factsBox = (await card.locator('dl').boundingBox())!;
      expect(factsBox.width / cardBox.width).toBeGreaterThan(0.8);
    }

    // No scanner here: no scan offered, and no word of keys or config.
    await expect(main.getByRole('button', { name: /^Scan/ })).toHaveCount(0);
    await expect(main).not.toContainText(/GEMINI|\.env|plugin/i);
    await shoot(page, 'tab', viewport.width);

    // The RC is asked for, and once added shows among the papers.
    const missingRc = main.getByTestId('missing-registration');
    await expect(missingRc).toBeVisible();
    await missingRc.getByRole('button', { name: 'Add RC' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Registration certificate/ })).toBeVisible();
    await dialog.getByLabel('RC number').fill(`MH12PV${digits}`);
    await dialog.getByLabel('Issuing authority (optional)').fill('RTO Pune (MH-12)');
    await dialog.getByRole('button', { name: 'Add Registration' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(cards.filter({ hasText: 'Registration certificate' })).toContainText(
      'RTO Pune (MH-12)',
    );
    await expect(missingRc).toHaveCount(0);
    await shoot(page, 'with-rc', viewport.width);

    // Fuel says nothing of configuration either.
    await page.goto(`/vehicles/${vehicle.id}?tab=history&view=fuel`);
    await expect(main.getByRole('heading', { name: 'Fuel history' })).toBeVisible();
    await expect(main.getByRole('button', { name: /scan receipt/i })).toHaveCount(0);
    await expect(main).not.toContainText(/GEMINI|\.env|plugin/i);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
