import { expect, test, type Locator, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function api(page: Page, path: string, data: Record<string, unknown>) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

/**
 * A finger's swipe, as the pointer events a touch screen sends: down, a short
 * move that decides the axis, the rest of the way, and up. `stopShort` lifts
 * the finger with the strip uncovered but before letting go would act.
 */
async function swipe(target: Locator, dx: number, dy = 0, { hold = false } = {}) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const init = { pointerId: 7, isPrimary: true, pointerType: 'touch', bubbles: true };
  await target.dispatchEvent('pointerdown', { ...init, clientX: x, clientY: y });
  await target.dispatchEvent('pointermove', {
    ...init,
    clientX: x + Math.sign(dx) * 12,
    clientY: y + Math.sign(dy) * 12,
  });
  await target.dispatchEvent('pointermove', { ...init, clientX: x + dx, clientY: y + dy });
  if (hold) return;
  await target.dispatchEvent('pointerup', { ...init, clientX: x + dx, clientY: y + dy });
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('a phone swipes an Upcoming row right for its verb and left for Snooze', async ({ page }) => {
  const suffix = uniqueSuffix();
  const short = suffix.slice(-4);
  await registerAndSignIn(page, {
    name: `E2E Swipe ${suffix}`,
    email: `e2e+swipe${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname: `Swipe ${short}`,
    odometer: '15200',
    registrationNumber: `MH12SW${short}`,
  });
  const vehicleId = new URL(vehicleUrl).pathname.split('/').pop()!;
  const done = await api(page, `/vehicles/${vehicleId}/reminders`, {
    title: `Wash the car ${short}`,
    type: 'custom',
    dueDate: daysFromNow(-1),
  });
  await api(page, `/vehicles/${vehicleId}/reminders`, {
    title: `Check the battery ${short}`,
    type: 'custom',
    dueDate: daysFromNow(3),
  });

  await page.goto('/upcoming');
  await expect(page.getByText('1 late · 1 this week')).toBeVisible();
  const wash = page.getByTestId('upcoming-row').filter({ hasText: `Wash the car ${short}` });
  const battery = page
    .getByTestId('upcoming-row')
    .filter({ hasText: `Check the battery ${short}` });

  // Partway: the strip names what letting go will do.
  await swipe(wash, 110, 0, { hold: true });
  await expect(page.getByTestId('swipe-strip')).toHaveText('Done');
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/upcoming-swipe-390.png`, animations: 'disabled' });
  await wash.dispatchEvent('pointercancel', { pointerId: 7, pointerType: 'touch', bubbles: true });
  await expect(page.getByTestId('swipe-strip')).toHaveCount(0);

  // A mostly vertical gesture is a scroll, and does nothing to the row.
  await swipe(wash, 90, 200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await prisma.reminder.findUniqueOrThrow({ where: { id: done.id } })).status).not.toBe(
    'completed',
  );

  // Right, all the way: Done.
  await swipe(wash, 120);
  await expect
    .poll(async () => (await prisma.reminder.findUniqueOrThrow({ where: { id: done.id } })).status)
    .toBe('completed');

  // Left: the same Snooze dialog the menu opens.
  await swipe(battery, -120);
  await expect(
    page.getByRole('dialog', { name: `Snooze Check the battery ${short}` }),
  ).toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
