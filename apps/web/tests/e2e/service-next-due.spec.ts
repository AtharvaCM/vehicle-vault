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

async function api(page: Page, method: 'POST' | 'PATCH', path: string, data: unknown) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.fetch(`/api${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

/**
 * The workshop writes down when to come back, and the extractor captures it.
 * A confirmed record now turns that into a reminder, keeps it current as the
 * record is edited, and leaves a record without one alone. This goes through
 * the real API, where the audit safety net fails any reminder write that is
 * not audited in its transaction.
 */
test('a confirmed service leaves a reminder for when to come back', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `NextDue ${suffix.slice(-4)}`;
  const workshop = `Torque Garage ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E NextDue ${suffix}`,
    email: `e2e+nextdue${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12ND${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  const record = await api(page, 'POST', `/vehicles/${vehicle.id}/maintenance-records`, {
    category: 'periodic_service',
    serviceDate: utcDay(-1).toISOString(),
    odometer: 15000,
    totalCost: 4200,
    workshopName: workshop,
    nextDueDate: utcDay(180).toISOString(),
    nextDueOdometer: 25000,
  });

  const made = await prisma.reminder.findUniqueOrThrow({
    where: { sourceMaintenanceRecordId: record.id },
  });
  expect(made).toMatchObject({
    vehicleId: vehicle.id,
    title: 'Periodic service due',
    type: 'service',
    dueOdometer: 25000,
  });
  expect(made.notes).toContain(`Set at the service at ${workshop}`);

  // It is an ordinary reminder, on the vehicle's list.
  await page.goto(`/vehicles/${vehicle.id}?tab=reminders`);
  await expect(page.getByText('Periodic service due').first()).toBeVisible();

  // Editing the record refreshes the same reminder rather than adding one.
  await api(page, 'PATCH', `/maintenance-records/${record.id}`, { nextDueOdometer: 26000 });
  const reminders = await prisma.reminder.findMany({
    where: { sourceMaintenanceRecordId: record.id },
  });
  expect(reminders).toHaveLength(1);
  expect(reminders[0]?.dueOdometer).toBe(26000);

  // A service with no next-due written on it leaves nothing behind.
  const plain = await api(page, 'POST', `/vehicles/${vehicle.id}/maintenance-records`, {
    category: 'detailing',
    serviceDate: utcDay(0).toISOString(),
    odometer: 15010,
    totalCost: 300,
  });
  expect(await prisma.reminder.count({ where: { sourceMaintenanceRecordId: plain.id } })).toBe(0);
  expect(await prisma.reminder.count({ where: { vehicleId: vehicle.id } })).toBe(1);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
