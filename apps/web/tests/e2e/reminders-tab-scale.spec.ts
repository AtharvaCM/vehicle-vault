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

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/reminders-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #367: the vehicle's Reminders tab scales to what is there. None: one empty
 * state, with the suggested schedule as the offer. One: the reminder first,
 * only its own group, no filters or selection bar, and the schedule folded
 * into a row. Many: search and filters; selection always behind Select.
 */
for (const viewport of VIEWPORTS) {
  test(`the Reminders tab scales to its list, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = suffix.slice(-4);
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Reminders ${suffix}`,
      email: `e2e+reminderstab${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12RT${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 18000,
      nickname: `Family ${digits}`,
    });
    const tabUrl = `/vehicles/${vehicle.id}?tab=reminders`;
    const main = page.getByRole('main');
    const searchBox = main.getByPlaceholder(/search by title/i);
    const selectionBar = main.getByText('Select reminders to take action');

    // None: one empty state, then the schedule to pick from.
    await page.goto(tabUrl);
    await expect(main.getByRole('heading', { name: 'No reminders yet' })).toBeVisible();
    await expect(main.getByText('Suggested service schedule')).toBeVisible();
    await expect(main.getByRole('checkbox').first()).toBeVisible();
    await expect(main.getByText(/no overdue reminders|no upcoming reminders/i)).toHaveCount(0);
    await shoot(page, 'none', viewport.width);

    // One: the reminder first, its group only, the schedule folded below.
    await post(page, `vehicles/${vehicle.id}/reminders`, {
      title: 'Wheel alignment',
      type: 'service',
      dueDate: daysFromNow(10),
    });
    await page.goto(tabUrl);
    const first = main.getByText('Wheel alignment').first();
    await expect(first).toBeVisible();
    await expect(main.getByText('1 reminder', { exact: true })).toBeVisible();
    await expect(main.getByText('Items that need attention immediately.')).toHaveCount(0);
    await expect(main.getByText('Completed reminders retained for history.')).toHaveCount(0);
    await expect(searchBox).toHaveCount(0);
    await expect(selectionBar).toHaveCount(0);
    await expect(main.getByRole('checkbox')).toHaveCount(0);
    const scheduleRow = main.getByRole('button', { name: /Suggested schedule/ });
    await expect(scheduleRow).toHaveAttribute('aria-expanded', 'false');
    expect((await scheduleRow.boundingBox())!.y).toBeGreaterThan((await first.boundingBox())!.y);
    await shoot(page, 'one', viewport.width);

    // Select brings the bar and the checkboxes; Done puts them away.
    await main.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(selectionBar).toBeVisible();
    await expect(
      main.getByRole('checkbox', { name: /select reminder wheel alignment/i }),
    ).toBeVisible();
    await main.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(selectionBar).toHaveCount(0);

    // The folded schedule opens in place.
    await scheduleRow.click();
    await expect(main.getByText('Suggested service schedule')).toBeVisible();
    await main.getByRole('button', { name: 'Hide' }).click();
    await expect(main.getByRole('button', { name: /Suggested schedule/ })).toBeVisible();

    // Many: search and filters.
    for (const [index, days] of [-3, 5, 20, 40, 60, 90].entries()) {
      await post(page, `vehicles/${vehicle.id}/reminders`, {
        title: `Check ${index + 1}`,
        type: 'service',
        dueDate: daysFromNow(days),
      });
    }
    await page.goto(tabUrl);
    await expect(main.getByText('7 reminders', { exact: true })).toBeVisible();
    await expect(searchBox).toBeVisible();
    await expect(main.getByText('Items that need attention immediately.')).toBeVisible();
    await expect(selectionBar).toHaveCount(0);
    await shoot(page, 'many', viewport.width);
  });
}
