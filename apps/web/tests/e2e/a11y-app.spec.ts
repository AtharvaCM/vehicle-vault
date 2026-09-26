import { expect, test, type Page } from '@playwright/test';

import { COLOUR_SCHEMES, expectAccessible } from './helpers/a11y';
import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

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

/** A signed-in garage with something on every screen: two vehicles, papers, a service, reminders. */
async function seededGarage(page: Page) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const digits = suffix.slice(-4);
  await registerAndSignIn(page, {
    name: `E2E Access ${suffix}`,
    email: `e2e+access${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const car = await post(page, 'vehicles', {
    registrationNumber: `MH12AC${digits}`,
    make: 'Hyundai',
    model: 'Creta',
    year: 2023,
    vehicleType: 'suv',
    fuelType: 'petrol',
    odometer: 18000,
    nickname: `Family ${digits}`,
  });
  await post(page, 'vehicles', {
    registrationNumber: `MH14EV${digits}`,
    make: 'Tata',
    model: 'Nexon EV',
    year: 2024,
    vehicleType: 'suv',
    fuelType: 'electric',
    odometer: 6000,
    nickname: `Nexon ${digits}`,
  });
  const reminder = await post(page, `vehicles/${car.id}/reminders`, {
    title: 'Wheel alignment',
    type: 'service',
    dueDate: daysFromNow(-2),
  });
  await post(page, `vehicles/${car.id}/reminders`, {
    title: 'Brake pads',
    type: 'service',
    dueDate: daysFromNow(4),
  });
  const record = await post(page, `vehicles/${car.id}/maintenance-records`, {
    category: 'periodic_service',
    status: 'confirmed',
    serviceDate: daysFromNow(-30),
    odometer: 17000,
    totalCost: 5180,
    workshopName: 'Torque Garage',
  });
  await prisma.insurancePolicy.create({
    data: {
      vehicleId: car.id,
      provider: 'Acme General',
      policyNumber: `OG-${digits}`,
      startDate: new Date(daysFromNow(-100)),
      endDate: new Date(daysFromNow(265)),
    },
  });
  return { vehicleId: car.id, reminderId: reminder.id, recordId: record.id };
}

/** Goes to a page and waits for its heading, so axe sees the content, not a skeleton. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** No status told by colour alone: every status dot and chip carries words. */
async function expectStatusInWords(page: Page, label: string) {
  const silent = await page.locator('[data-status]').evaluateAll((elements) =>
    elements
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .filter((element) => !(element.textContent ?? '').trim())
      .map((element) => element.outerHTML.slice(0, 120)),
  );
  expect(silent, `${label}: status shown by colour alone`).toEqual([]);
}

async function check(page: Page, label: string) {
  await expectAccessible(page, label);
  await expectStatusInWords(page, label);
}

/**
 * #357: the signed-in app passes axe (WCAG 2.1 AA, serious and critical) at
 * phone and desktop widths, light and dark, with no status told by colour
 * alone: Home, Garage, each vehicle tab, Upcoming, History, Costs, a service
 * record, a reminder, Settings, and the main dialogs.
 */
for (const viewport of VIEWPORTS) {
  for (const scheme of COLOUR_SCHEMES) {
    test(`the signed-in app passes axe at ${viewport.width}px, ${scheme}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      const { vehicleId, reminderId, recordId } = await seededGarage(page);
      const at = `at ${viewport.width}px, ${scheme}`;

      for (const path of [
        '/home',
        '/garage',
        `/vehicles/${vehicleId}`,
        `/vehicles/${vehicleId}?tab=history`,
        `/vehicles/${vehicleId}?tab=reminders`,
        `/vehicles/${vehicleId}?tab=papers`,
        `/vehicles/${vehicleId}?tab=more`,
        '/upcoming',
        '/history',
        '/costs',
        `/maintenance-records/${recordId}`,
        `/reminders/${reminderId}`,
        `/vehicles/${vehicleId}/maintenance/new`,
        '/settings',
        '/settings/preferences',
        '/settings/activity',
      ]) {
        await open(page, path);
        await check(page, `${path} ${at}`);
      }

      // Quick log.
      await open(page, '/home');
      const logButton =
        viewport.width < 768
          ? page.getByTestId('bottom-nav').getByRole('button', { name: 'Log' })
          : page.getByRole('main').getByRole('button', { name: 'Log', exact: true });
      await logButton.click();
      await expect(page.getByRole('dialog', { name: 'Log' })).toBeVisible();
      await page.waitForTimeout(200);
      await check(page, `Quick log ${at}`);
      await page.keyboard.press('Escape');

      // Add papers, from the vehicle's Papers tab.
      await open(page, `/vehicles/${vehicleId}?tab=papers`);
      await page
        .getByRole('button', { name: /add policy/i })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(200);
      await check(page, `add papers ${at}`);
      await page.keyboard.press('Escape');

      // A confirm: deleting the reminder, cancelled.
      await open(page, `/reminders/${reminderId}`);
      await page
        .getByRole('button', { name: /more|actions/i })
        .first()
        .click();
      await page.getByRole('menuitem', { name: /delete/i }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.waitForTimeout(200);
      await check(page, `confirm ${at}`);
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /cancel/i })
        .click();
    });
  }
}

test('a dialog keeps focus inside and hands it back to the control that opened it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seededGarage(page);
  await open(page, '/home');
  const logButton = page.getByRole('main').getByRole('button', { name: 'Log', exact: true });
  await logButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Log' });
  await expect(dialog).toBeVisible();

  // Tab well past the dialog's controls: focus never leaves it.
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab');
    const inside = await dialog.evaluate((element) => element.contains(document.activeElement));
    expect(inside, `focus left the dialog after ${index + 1} tabs`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(logButton).toBeFocused();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
