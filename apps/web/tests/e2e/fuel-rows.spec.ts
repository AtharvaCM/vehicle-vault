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

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * #369: the vehicle's fuel history is compact rows, each with the economy it
 * earned since the fill before; Log fuel is the one primary action, with Scan
 * and Import in a menu that never wraps it; and one economy card, not two.
 */
for (const viewport of VIEWPORTS) {
  test(`fuel history as compact rows, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = suffix.slice(-4);
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Fuel ${suffix}`,
      email: `e2e+fuelrows${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12FR${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 14000,
      nickname: `Family ${digits}`,
    });
    for (const [days, odometer, quantity, totalCost, location] of [
      [-40, 14_000, 32, 3360, undefined],
      [-25, 14_420, 30, 3150, 'Indian Oil, Baner Road'],
      [-12, 14_860, 35, 3710, undefined],
      [-2, 15_200, 25, 2650, 'HP, Mumbai–Pune Expressway, Lonavala food mall outlet'],
    ] as const) {
      await post(page, `fuel-logs/vehicle/${vehicle.id}`, {
        date: daysFromNow(days),
        odometer,
        quantity,
        price: Math.round(totalCost / quantity),
        totalCost,
        ...(location ? { location } : {}),
      });
    }

    await page.goto(`/vehicles/${vehicle.id}?tab=history&view=fuel`);
    const main = page.getByRole('main');
    const rows = main.getByTestId('fuel-row');
    await expect(rows).toHaveCount(4);

    // Newest first, each with its economy; the first fill has none to earn.
    await expect(rows.nth(0)).toContainText('25 L');
    await expect(rows.nth(0)).toContainText('15,200 km');
    await expect(rows.nth(0)).toContainText('₹2,650');
    await expect(rows.nth(0)).toContainText('13.6 km/L');
    await expect(rows.nth(1)).toContainText('12.6 km/L');
    await expect(rows.nth(2)).toContainText('14.0 km/L');
    await expect(rows.nth(3)).not.toContainText('km/L');

    // Compact: a phone row is two short lines, a desktop row one.
    for (const row of await rows.all()) {
      const height = (await row.boundingBox())!.height;
      expect(height).toBeLessThan(viewport.width < 768 ? 96 : 72);
    }

    // One primary action; Scan and Import in the menu beside it, never over it.
    const logFuel = main.getByRole('button', { name: 'Log fuel' });
    // No scanner here, so Import is a plain button beside Log fuel.
    const more = main.getByRole('button', { name: 'Import CSV', exact: true });
    const logBox = (await logFuel.boundingBox())!;
    const moreBox = (await more.boundingBox())!;
    expect(Math.abs(logBox.y - moreBox.y), 'Log fuel sits on Import’s row').toBeLessThan(2);
    await expect(main.getByRole('button', { name: /scan/i })).toHaveCount(0);

    // One economy card.
    await expect(main.getByText('Real fuel economy')).toHaveCount(1);
    await expect(main.getByText('Getting an accurate figure')).toHaveCount(0);

    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/fuel-rows-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
  });
}
