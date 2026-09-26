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
      path: `${SHOTS}/service-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #366: the vehicle's service view leads with the log. An empty log starts
 * from the bill; the history from before the vehicle was added is offered
 * once below the log, can be put away, and comes back behind one button with
 * its Save beside its rows; a saved service opens on its own record.
 */
for (const viewport of VIEWPORTS) {
  test(`the service view leads with the log, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = suffix.slice(-4);
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Service ${suffix}`,
      email: `e2e+servicelog${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12SL${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 18000,
      nickname: `Family ${digits}`,
    });
    const historyUrl = `/vehicles/${vehicle.id}?tab=history`;

    // Empty: Snap the bill first, then logging by hand; the prompt below.
    await page.goto(historyUrl);
    const log = page.getByTestId('vehicle-service-history');
    await expect(log.getByRole('heading', { name: 'No service records yet' })).toBeVisible();
    const snap = log.getByRole('button', { name: 'Snap the bill' });
    const byHand = log.getByRole('link', { name: 'Log your first service' });
    await expect(snap).toBeVisible();
    const snapBox = (await snap.boundingBox())!;
    const byHandBox = (await byHand.boundingBox())!;
    expect(byHandBox.y, 'Snap the bill comes first').toBeGreaterThan(snapBox.y);
    const prompt = page.getByTestId('service-baseline-prompt');
    await expect(prompt).toContainText('Services done before you added it');
    expect((await prompt.boundingBox())!.y).toBeGreaterThan(
      (await log.boundingBox())!.y + (await log.boundingBox())!.height - 1,
    );
    await expect(page.getByLabel(/last done at odometer/i)).toHaveCount(0);
    await shoot(page, 'empty', viewport.width);

    // Put away, and it stays away.
    await prompt.getByRole('button', { name: 'Not now' }).click();
    await expect(prompt).toHaveCount(0);
    await page.reload();
    await expect(log.getByRole('heading', { name: 'No service records yet' })).toBeVisible();
    await expect(page.getByTestId('service-baseline-prompt')).toHaveCount(0);

    // On demand: the rows, with Save right under them.
    await page.getByRole('button', { name: 'Add what was done before you added it' }).click();
    const baseline = page.getByTestId('service-baseline');
    const rows = baseline.getByLabel(/last done at odometer/i);
    await expect(rows.first()).toBeVisible();
    const lastRow = (await rows.last().boundingBox())!;
    const save = (await baseline.getByRole('button', { name: 'Save history' }).boundingBox())!;
    expect(save.y - (lastRow.y + lastRow.height), 'Save sits under the rows').toBeLessThan(64);
    expect(save.x - (await baseline.boundingBox())!.x, 'Save sits at the rows’ edge').toBeLessThan(
      64,
    );
    await shoot(page, 'baseline-open', viewport.width);
    await baseline.getByRole('button', { name: 'Close' }).click();

    // Log a service by hand: it opens on the saved record.
    await byHand.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Log service' })).toBeVisible();
    await page.getByRole('button', { name: 'Oil change' }).click();
    await page.getByLabel('Total on the bill').fill('2400');
    await page.getByRole('button', { name: 'Save service' }).click();
    await expect(page).toHaveURL(/\/maintenance-records\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/oil/i);

    // With a record, the log is the first thing on the view.
    await page.goto(historyUrl);
    await expect(log.getByRole('link', { name: /oil/i }).first()).toBeVisible();
    const onDemand = page.getByRole('button', { name: 'Add what was done before you added it' });
    expect((await onDemand.boundingBox())!.y).toBeGreaterThan((await log.boundingBox())!.y);
    await shoot(page, 'with-record', viewport.width);
  });
}
