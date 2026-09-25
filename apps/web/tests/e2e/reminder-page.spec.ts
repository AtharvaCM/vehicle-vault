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
  test(`the reminder page is one decision, at ${viewport.width}px`, async ({ page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndSignIn(page, {
      name: `E2E Reminder ${suffix}`,
      email: `e2e+reminderpage${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname: `Decide ${suffix.slice(-4)}`,
      odometer: '26300',
      registrationNumber: `MH12RP${suffix.slice(-4)}`,
    });
    const vehicleId = vehicleUrl.split('/').pop()!;
    const late = await post(page, `vehicles/${vehicleId}/reminders`, {
      title: 'Wash and wax',
      type: 'custom',
      dueDate: daysFromNow(-3),
    });
    const byKm = await post(page, `vehicles/${vehicleId}/reminders`, {
      title: 'Engine oil change',
      type: 'service',
      dueOdometer: 27_500,
    });

    await page.setViewportSize(viewport);

    // A plain to-do: late, in words, with Done as its one verb.
    await page.goto(`/reminders/${late.id}`);
    await expect(page.getByTestId('reminder-due')).toHaveText(/^Overdue by 3 days — was due /);
    const decision = page.getByTestId('reminder-decision');
    await expect(decision.getByRole('button', { name: 'Mark Wash and wax done' })).toBeVisible();
    await expect(decision.getByRole('button', { name: 'Snooze Wash and wax' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More reminder actions' })).toBeVisible();
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/reminder-late-${viewport.width}.png`,
        animations: 'disabled',
      });

    // A service by distance: kilometres to go, and Log service first.
    await page.goto(`/reminders/${byKm.id}`);
    await expect(page.getByTestId('reminder-due')).toHaveText(/^Due at 27,500 km — 1,200 km to go/);
    await expect(decision.getByRole('link', { name: 'Log service' })).toBeVisible();
    await expect(decision.getByRole('button', { name: 'Mark done without logging' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/reminder-service-${viewport.width}.png`,
        animations: 'disabled',
      });

    // Mark done without logging: it says so.
    await decision.getByRole('button', { name: 'Mark done without logging' }).click();
    await expect(page.getByTestId('reminder-due')).toHaveText(/^Done on /);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
