import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function utcDay(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

async function api(page: Page, path: string, data: unknown) {
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How the form writes a reminder's due: "42,000 km or 23 Sep 2027, whichever first." */
function dueWords(dueOdometer: number | null, dueDate: Date | null) {
  const km =
    dueOdometer === null ? null : `${new Intl.NumberFormat('en-IN').format(dueOdometer)} km`;
  const on = dueDate
    ? `${dueDate.getUTCDate()} ${MONTHS[dueDate.getUTCMonth()]} ${dueDate.getUTCFullYear()}`
    : null;

  if (km && on) return `${km} or ${on}, whichever first.`;
  return km ? `At ${km}.` : `On ${on}.`;
}

async function setUp(page: Page, label: string) {
  const suffix = uniqueSuffix();
  const nickname = `${label} ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+logservice${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '32000',
    registrationNumber: `MH12LS${suffix.slice(-4)}`,
  });

  return { suffix, vehicle: await prisma.vehicle.findFirstOrThrow({ where: { nickname } }) };
}

/**
 * The most frequent write, on a phone: the oil change that is due is already
 * picked, the date and reading are filled in, and the total is the one field
 * left. Everything needed, Save included, is on the first screen.
 */
test('logs the oil change that is due on a phone, in one screen', async ({ page }) => {
  const { vehicle } = await setUp(page, 'LogPhone');
  // The reminder a previous oil change left, due today.
  await api(page, `/vehicles/${vehicle.id}/reminders`, {
    title: 'Engine oil due',
    type: 'service',
    dueDate: utcDay(0).toISOString(),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/vehicles/${vehicle.id}/maintenance/new`);
  await expect(page.getByRole('heading', { level: 1, name: 'Log service' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Snap the bill' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Oil change', pressed: true })).toBeVisible();
  await expect(page.getByText('Picked because the oil change is due today.')).toBeVisible();
  await expect(page.getByLabel('Odometer', { exact: true })).toHaveValue('32000');
  await expect(
    page.getByText('Today, and the last reading you saved. Change them if the visit was earlier.'),
  ).toBeVisible();
  await expect(page.getByText(/quick entry|detailed entry|common tasks/i)).toHaveCount(0);

  // The total and Save are on the first screen; Save is 52px, above the bottom bar.
  const total = page.getByLabel('Total on the bill');
  const save = page.getByRole('button', { name: 'Save service' });
  const viewport = page.viewportSize()!;
  const bottomBar = (await page.getByTestId('bottom-nav').boundingBox())!;
  for (const control of [total, save]) {
    const box = (await control.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(bottomBar.y);
  }
  expect(Math.round((await save.boundingBox())!.height)).toBe(52);
  expect(bottomBar.y + bottomBar.height).toBeLessThanOrEqual(viewport.height + 1);

  await total.fill('180000');
  await expect(total).toHaveValue('1,80,000');
  await total.fill('1850');
  await expect(total).toHaveValue('1,850');

  const nextDue = page.getByTestId('next-due');
  await expect(nextDue).toContainText('Next oil change');
  await expect(nextDue).toContainText("whichever first. We'll remind you.");
  const preview = await nextDue.textContent();
  await page.screenshot({ path: 'test-results/log-service-390.png', animations: 'disabled' });

  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await save.click();

  await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}\\?tab=history`));
  const record = await prisma.maintenanceRecord.findFirstOrThrow({
    where: { vehicleId: vehicle.id },
  });
  expect(record).toMatchObject({ category: 'engine_oil', odometer: 32000, status: 'confirmed' });
  expect(Number(record.totalCost)).toBe(1850);

  // What the form said before saving is what the API scheduled.
  const reminder = await prisma.reminder.findUniqueOrThrow({
    where: { sourceMaintenanceRecordId: record.id },
  });
  expect(reminder.title).toBe('Engine oil due');
  expect(preview).toContain(dueWords(reminder.dueOdometer, reminder.dueDate));
  expect(reminder.dueOdometer).toBe(record.nextDueOdometer);
  expect(reminder.dueDate?.toISOString()).toBe(record.nextDueDate?.toISOString());
});

/**
 * Another flow hands over the work and the reminder (`?category=&reminderId=`),
 * and the workshop comes from the owner's history rather than being typed.
 */
test('logs a service for a reminder, at the workshop used before, on a desktop', async ({
  page,
}) => {
  const { suffix, vehicle } = await setUp(page, 'LogDesk');
  const workshop = `Torque Garage ${suffix.slice(-4)}`;
  await api(page, `/vehicles/${vehicle.id}/maintenance-records`, {
    category: 'periodic_service',
    serviceDate: utcDay(-200).toISOString(),
    odometer: 25000,
    totalCost: 4200,
    workshopName: workshop,
  });
  const reminder = await api(page, `/vehicles/${vehicle.id}/reminders`, {
    title: 'Brake pads due',
    type: 'service',
    dueDate: utcDay(20).toISOString(),
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/vehicles/${vehicle.id}/maintenance/new?category=brake_pads&reminderId=${reminder.id}`,
  );

  await expect(page.getByRole('button', { name: 'Brakes', pressed: true })).toBeVisible();
  await expect(page.getByText('For your reminder “Brake pads due”.')).toBeVisible();

  await page.getByRole('button', { name: /^Workshop/ }).click();
  await page.getByRole('button', { name: workshop }).click();
  await expect(page.getByLabel('Workshop or garage')).toHaveValue(workshop);
  await page.getByLabel('Total on the bill').fill('3200');
  await expect(page.getByTestId('next-due')).toContainText('Next brake pad check');
  await page.screenshot({
    path: 'test-results/log-service-1440.png',
    animations: 'disabled',
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Save service' }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}\\?tab=history`));

  const saved = await prisma.maintenanceRecord.findFirstOrThrow({
    where: { vehicleId: vehicle.id, category: 'brake_pads' },
  });
  expect(saved.workshopName).toBe(workshop);
  expect(Number(saved.totalCost)).toBe(3200);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
