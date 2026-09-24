import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function atNoonUtc(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(12, 0, 0, 0);
  return copy;
}

function daysFromNow(offsetDays: number): Date {
  const date = atNoonUtc(new Date());
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One fresh user and one vehicle they own, seeded straight in the database
 * (only the behaviour under test goes through the UI). `regCode` and
 * `nicknameWord` just keep each scenario's rows easy to tell apart in a
 * failure screenshot.
 */
async function registerAndSeedVehicle(page: Page, regCode: string, nicknameWord: string) {
  const suffix = uniqueSuffix();
  const short = suffix.slice(-4);
  const email = `e2erenewal+${regCode.toLowerCase()}${suffix}@vehiclevault.dev`;

  await registerAndSignIn(page, {
    name: `E2E Renewal ${nicknameWord} ${suffix}`,
    email,
    password: 'VehicleVault!234',
  });

  const user = await prisma.user.findFirstOrThrow({ where: { email: email.toLowerCase() } });
  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      registrationNumber: `MH12${regCode}${short}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      fuelType: 'petrol',
      vehicleType: 'suv',
      nickname: `${nicknameWord} ${short}`,
      odometer: 15000,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });

  return { short, vehicle };
}

/**
 * Creates an insurance reminder through the reminder form, the way a user
 * would: the Insurance quick fill sets type and a starting title, the due
 * date is whatever is typed, and the API's `linkRenewalReminder` links it to
 * the vehicle's policy of record on save if one is on file with nothing else
 * following it. Returns the created reminder's id.
 */
async function createInsuranceReminder(
  page: Page,
  vehicleId: string,
  title: string,
  dueDateOffsetDays: number,
): Promise<string> {
  await page.goto(`/vehicles/${vehicleId}/reminders/new`);
  await page.getByRole('button', { name: 'Insurance', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel(/due date/i).fill(isoDay(daysFromNow(dueDateOffsetDays)));
  await page.getByRole('button', { name: /save reminder/i }).click();

  // Anchored on a UUID, not just "no more slashes": the create page's own URL
  // (".../vehicles/<id>/reminders/new") would otherwise satisfy a looser
  // pattern before the redirect actually happens, and "new" is not a reminder id.
  await expect(page).toHaveURL(/\/reminders\/[0-9a-f-]{36}$/i);
  return page.url().split('/reminders/')[1]!;
}

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/**
 * Scenario 1 — link on create + one row: a vehicle with an insurance policy
 * ending soon, and a fresh insurance reminder created through the form links
 * to it on save, so the paper and the reminder are one row everywhere.
 */
async function linkOnCreateScenario(page: Page) {
  const { short, vehicle } = await registerAndSeedVehicle(page, 'LK', 'Link');
  const policyEnd = daysFromNow(5);
  await prisma.insurancePolicy.create({
    data: {
      vehicleId: vehicle.id,
      provider: `Scenario1 Insurer ${short}`,
      startDate: daysFromNow(-360),
      endDate: policyEnd,
    },
  });

  const title = `Insurance renewal ${short}`;
  const reminderId = await createInsuranceReminder(page, vehicle.id, title, 20);

  await expect(page.getByTestId('reminder-follows-paper')).toContainText('insurance policy');

  // Edit page: the due date follows the paper and can't be changed here.
  await page.goto(`/reminders/${reminderId}/edit`);
  const dueDateInput = page.getByLabel(/due date/i);
  await expect(dueDateInput).toHaveValue(isoDay(policyEnd));
  await expect(dueDateInput).toHaveAttribute('readonly', '');
  await expect(
    page.getByText('Follows the insurance policy: due when it ends. Change the date on the paper.'),
  ).toBeVisible();

  // Upcoming: one row, in This week (5 days out), a document row with Renew.
  await page.goto('/upcoming');
  const weekGroup = page.getByTestId('upcoming-group-this_week');
  const weekRow = weekGroup.getByTestId('upcoming-row').filter({ hasText: title });
  await expect(weekRow).toHaveCount(1);
  await expect(weekRow).toHaveAttribute('data-kind', 'document');
  // exact: true — the title itself, "Insurance renewal ...", contains "renew".
  await expect(weekRow.getByRole('link', { name: 'Renew', exact: true })).toBeVisible();
  // No separate reminder row for the same renewal anywhere on the page.
  await expect(page.getByTestId('upcoming-row').filter({ hasText: title })).toHaveCount(1);

  // Home agrees: one attention row for it too.
  await page.goto('/home');
  await expect(page.getByTestId('attention-row').filter({ hasText: title })).toHaveCount(1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`Renewal follows paper — link on create at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('a reminder created for a vehicle with a policy links to it, one row everywhere', async ({
      page,
    }) => {
      await linkOnCreateScenario(page);
    });
  });
}

test.describe('Renewal follows paper', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('renewing the policy rolls the reminder to the new one', async ({ page }) => {
    const { short, vehicle } = await registerAndSeedVehicle(page, 'RL', 'Roll');
    const policyEnd = daysFromNow(5);
    await prisma.insurancePolicy.create({
      data: {
        vehicleId: vehicle.id,
        provider: `Scenario2 Insurer ${short}`,
        startDate: daysFromNow(-360),
        endDate: policyEnd,
      },
    });

    const title = `Insurance renewal ${short}`;
    await createInsuranceReminder(page, vehicle.id, title, 20);

    // Renew from the Papers tab, the way document-renewal.spec.ts does.
    await page.goto(`/vehicles/${vehicle.id}?tab=papers`);
    await page.getByRole('button', { name: 'Renew', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Renewing: details are copied/)).toBeVisible();
    await dialog.getByRole('button', { name: /^add policy$/i }).click();
    await expect(dialog).toBeHidden();

    const policies = await prisma.insurancePolicy.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { startDate: 'asc' },
    });
    expect(policies).toHaveLength(2);
    const [oldPolicy, newPolicy] = policies;

    // The old reminder is completed and still points at the old (superseded)
    // policy; a successor with the same title follows the new one, open.
    type LinkedReminderRow = {
      status: string;
      completedAt: Date | null;
      insurancePolicyId: string | null;
      dueDate: Date | null;
    };
    await expect
      .poll(async () => {
        const rows: LinkedReminderRow[] = await prisma.reminder.findMany({
          where: { vehicleId: vehicle.id, title },
          orderBy: { createdAt: 'asc' },
          select: { status: true, completedAt: true, insurancePolicyId: true, dueDate: true },
        });
        return rows.map((row) => ({
          status: row.status,
          completed: row.completedAt !== null,
          insurancePolicyId: row.insurancePolicyId,
          dueDate: row.dueDate ? isoDay(row.dueDate) : null,
        }));
      })
      .toEqual([
        {
          status: 'completed',
          completed: true,
          insurancePolicyId: oldPolicy.id,
          dueDate: isoDay(policyEnd),
        },
        {
          status: 'upcoming',
          completed: false,
          insurancePolicyId: newPolicy.id,
          dueDate: isoDay(newPolicy.endDate as Date),
        },
      ]);

    // The renewal is now about a year off: one row, in Later.
    await page.goto('/upcoming');
    const laterGroup = page.getByTestId('upcoming-group-later');
    const row = laterGroup.getByTestId('upcoming-row').filter({ hasText: title });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute('data-kind', 'document');
  });

  test('deleting the policy leaves a plain reminder dated where it ended', async ({ page }) => {
    const { short, vehicle } = await registerAndSeedVehicle(page, 'UL', 'Unlink');
    const provider = `Scenario3 Insurer ${short}`;
    const policyEnd = daysFromNow(5);
    await prisma.insurancePolicy.create({
      data: { vehicleId: vehicle.id, provider, startDate: daysFromNow(-360), endDate: policyEnd },
    });

    const title = `Insurance renewal ${short}`;
    const reminderId = await createInsuranceReminder(page, vehicle.id, title, 20);

    // Delete the policy through the Papers tab, as document-smoke.spec.ts does.
    await page.goto(`/vehicles/${vehicle.id}?tab=papers`);
    const policyCard = page.locator('[data-slot="card"]').filter({ hasText: provider });
    await policyCard.getByRole('button', { name: 'Delete document' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(provider)).toHaveCount(0);

    await expect
      .poll(async () => {
        const reminder = await prisma.reminder.findUniqueOrThrow({
          where: { id: reminderId },
          select: { insurancePolicyId: true, completedAt: true, dueDate: true },
        });
        return {
          insurancePolicyId: reminder.insurancePolicyId,
          completed: reminder.completedAt !== null,
          dueDate: reminder.dueDate ? isoDay(reminder.dueDate) : null,
        };
      })
      .toEqual({ insurancePolicyId: null, completed: false, dueDate: isoDay(policyEnd) });

    await page.goto(`/reminders/${reminderId}`);
    await expect(page.getByTestId('reminder-follows-paper')).toHaveCount(0);

    await page.goto('/upcoming');
    const row = page.getByTestId('upcoming-row').filter({ hasText: title });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute('data-kind', 'reminder');
  });

  test('adding a matching paper adopts the vehicle open reminder', async ({ page }) => {
    const { short, vehicle } = await registerAndSeedVehicle(page, 'AD', 'Adopt');
    const title = `PUC certificate renewal ${short}`;
    await prisma.reminder.create({
      data: {
        vehicleId: vehicle.id,
        title,
        type: 'puc',
        status: 'upcoming',
        dueDate: daysFromNow(10),
      },
    });

    const pucEnd = daysFromNow(12);
    await page.goto(`/vehicles/${vehicle.id}?tab=papers`);
    await page.getByRole('button', { name: 'Add document', exact: true }).click();
    const dialog = page.getByRole('dialog');
    // No id ties the "Document type" label to its select trigger, so it is
    // found by role instead: the only combobox in the dialog until a
    // warranty kind is chosen, which never happens in this flow.
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'PUC certificate' }).click();
    await dialog.getByLabel('End date').fill(isoDay(pucEnd));
    await dialog.getByRole('button', { name: /^add puc certificate$/i }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/upcoming');
    const row = page.getByTestId('upcoming-row').filter({ hasText: title });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute('data-kind', 'document');
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
