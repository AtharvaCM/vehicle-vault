import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';

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

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/engine-oil-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #332: the owner records the engine oil once, on Edit vehicle; About this
 * vehicle shows it, and Log service shows it beside oil work.
 */
for (const viewport of VIEWPORTS) {
  test(`the owner records the engine oil once, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Oil ${suffix}`,
      email: `e2e+engineoil${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12EO${suffix.slice(-4)}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 18000,
      nickname: `Family ${suffix.slice(-4)}`,
    });
    const main = page.getByRole('main');
    const aboutUrl = `/vehicles/${vehicle.id}?tab=more&section=about`;

    // Nothing on file: About offers to add it.
    await page.goto(aboutUrl);
    const row = main.getByTestId('about-engine-oil');
    await row.getByRole('link', { name: 'Add engine oil' }).click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}/edit$`));

    await main.getByLabel('Engine oil grade (optional)').fill('5W-30');
    await main.getByLabel('Engine oil quantity (L, optional)').fill('3.8');
    await main.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}$`));

    await page.goto(aboutUrl);
    await expect(main.getByTestId('about-engine-oil')).toContainText('5W-30 · 3.8 L');
    await shoot(page, 'about', viewport.width);

    // Beside oil work in Log service, and nowhere else.
    await page.goto(`/vehicles/${vehicle.id}/maintenance/new`);
    await page.getByRole('button', { name: 'Tyres', exact: true }).click();
    await expect(page.getByTestId('engine-oil-hint')).toHaveCount(0);
    await page.getByRole('button', { name: 'Oil change', exact: true }).click();
    await expect(page.getByTestId('engine-oil-hint')).toHaveText(
      'This engine takes 5W-30 · 3.8 L.',
    );
    await shoot(page, 'log-service', viewport.width);
  });
}
