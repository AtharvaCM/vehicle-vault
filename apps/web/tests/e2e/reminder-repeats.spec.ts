import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test('a yearly insurance reminder schedules next year’s when it is marked done', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const email = `e2erepeat+${suffix}@vehiclevault.dev`;

  await registerAndSignIn(page, {
    email,
    name: `E2E Repeat ${suffix}`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname: `Repeat Garage ${suffix.slice(-4)}`,
    odometer: '15200',
    registrationNumber: `MH12RP${suffix.slice(-4)}`,
  });

  await page.getByRole('main').getByRole('button', { name: 'Log' }).click();
  await page.getByRole('menuitem', { name: 'Reminder' }).click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/reminders\/new$/);

  // The quick fill sets the cadence, not just the title.
  await page.getByRole('button', { name: 'Insurance', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /repeats/i })).toHaveText('Every year');
  await page.getByLabel(/due date/i).fill('2027-03-01');
  await page.getByRole('button', { name: /save reminder/i }).click();

  await expect(page).toHaveURL(/\/reminders\/[^/]+$/);
  await expect(page.getByText('Repeats every year', { exact: true })).toBeVisible();

  // Not a service, so Done ticks it off without asking to log anything.
  await page.getByRole('button', { name: 'Mark Insurance renewal done' }).click();

  // Renewed early, the next one keeps the policy's cycle: 1 March next year.
  await expect
    .poll(async () => {
      const rows = await prisma.reminder.findMany({
        where: { vehicle: { user: { email } }, title: 'Insurance renewal' },
        orderBy: { createdAt: 'asc' },
        select: { status: true, dueDate: true, repeatEveryMonths: true, notes: true },
      });
      return rows.map((row) => ({
        status: row.status,
        dueDate: row.dueDate?.toISOString().slice(0, 10),
        repeatEveryMonths: row.repeatEveryMonths,
        notes: row.notes,
      }));
    })
    .toEqual([
      { status: 'completed', dueDate: '2027-03-01', repeatEveryMonths: 12, notes: null },
      { status: 'upcoming', dueDate: '2028-03-01', repeatEveryMonths: 12, notes: null },
    ]);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
