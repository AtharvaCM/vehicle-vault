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
      path: `${SHOTS}/forms-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/** Save is the primary action: full width and on screen on a phone, beside Cancel from md. */
async function expectPrimarySave(page: Page, name: string, width: number) {
  const save = page.getByRole('button', { name, exact: true });
  await expect(save).toBeVisible();
  const box = (await save.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (width < 768) {
    // The width of the form's card, less its own padding.
    expect(box.width, `${name} spans the form`).toBeGreaterThan(viewport.width - 72);
    // Pinned above the bottom bar, so it is on screen before any scrolling.
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  } else {
    const cancel = page.getByRole('link', { name: 'Cancel', exact: true });
    await expect(cancel).toBeVisible();
    expect(Math.abs((await cancel.boundingBox())!.y - box.y)).toBeLessThan(4);
  }
}

/**
 * #370: Edit vehicle speaks for itself, with a grouped odometer and a clear
 * Save; Add vehicle and the reminder form take the width with no filler
 * card; the reminder form links to the suggested schedule; auth forms leave
 * checking to their inline messages.
 */
for (const viewport of VIEWPORTS) {
  test(`Edit vehicle, Add vehicle and the reminder form, at ${viewport.width}px`, async ({
    page,
  }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = suffix.slice(-4);
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Forms ${suffix}`,
      email: `e2e+formpolish${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12FM${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 32000,
      nickname: `Family ${digits}`,
    });
    const main = page.getByRole('main');

    // Edit vehicle: its own words, a grouped reading, a clear Save.
    await page.goto(`/vehicles/${vehicle.id}/edit`);
    await expect(main.getByRole('heading', { level: 1, name: 'Edit vehicle' })).toBeVisible();
    await expect(main.getByText(/Add the basics|Start with vehicle type and year/)).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Back to vehicle' })).toHaveCount(0);
    await expect(main.getByText('Keep details accurate')).toHaveCount(0);
    const odometer = main.getByLabel('Odometer', { exact: true });
    await expect(odometer).toHaveValue('32,000');
    await expectPrimarySave(page, 'Save changes', viewport.width);
    await shoot(page, 'edit-vehicle', viewport.width);
    await odometer.fill('32500');
    await expect(odometer).toHaveValue('32,500');
    await main.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}$`));
    await expect(main.getByText(/32,500 km/).first()).toBeVisible();

    // Add vehicle: no advice card beside the form.
    await page.goto('/vehicles/new');
    await expect(main.getByRole('heading', { level: 1, name: 'Add vehicle' })).toBeVisible();
    await expect(main.getByText('What to add first')).toHaveCount(0);
    await expect(main.getByText(/Start with the odometer reading/)).toBeVisible();
    await shoot(page, 'add-vehicle', viewport.width);

    // The reminder form: Save first, no filler, a way to the schedule.
    await page.goto(`/vehicles/${vehicle.id}/reminders/new`);
    await expect(main.getByRole('heading', { level: 1, name: 'Add reminder' })).toBeVisible();
    await expect(main.getByText('Good reminder habits')).toHaveCount(0);
    await expect(main.getByText(/Use a due date, a due odometer, or both/)).toHaveCount(0);
    await expect(
      main.getByRole('link', { name: 'Pick from the suggested service schedule' }),
    ).toHaveAttribute('href', `/vehicles/${vehicle.id}?tab=reminders`);
    await expectPrimarySave(page, 'Save reminder', viewport.width);
    await shoot(page, 'reminder', viewport.width);
  });
}

test('sign-in checks with its own inline message, not the browser’s bubble', async ({ page }) => {
  await page.goto('/login');
  const form = page.locator('form').filter({ has: page.getByLabel('Email address') });
  await expect(form).toHaveAttribute('novalidate', '');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/login/);
});
