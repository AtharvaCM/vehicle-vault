import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/** Set to a directory to keep screenshots of each step (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function daysFromNow(offsetDays: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

function utcDay(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, animations: 'disabled' });
}

/** An account with one car and an oil change that is two days late and repeats. */
async function seedGarage(page: Page) {
  const suffix = uniqueSuffix();
  const short = suffix.slice(-4);
  const email = `e2edone+${suffix}@vehiclevault.dev`;

  await registerAndSignIn(page, {
    email,
    name: `E2E Done ${short}`,
    password: 'VehicleVault!234',
  });
  const user = await prisma.user.findFirstOrThrow({ where: { email: email.toLowerCase() } });
  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      registrationNumber: `MH12RD${short}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      fuelType: 'petrol',
      vehicleType: 'suv',
      nickname: `Done Garage ${short}`,
      odometer: 15200,
      setupPromptDismissedAt: new Date(),
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
  const title = `Engine oil change ${short}`;
  const reminder = await prisma.reminder.create({
    data: {
      vehicleId: vehicle.id,
      title,
      type: 'service',
      status: 'overdue',
      catalogSlug: 'engine_oil_change',
      dueDate: daysFromNow(-2),
      dueOdometer: 15000,
      repeatEveryKm: 10000,
      repeatEveryMonths: 12,
    },
  });

  return { vehicle, reminder, title, short };
}

for (const viewport of VIEWPORTS) {
  test.describe(`reminder Done and Snooze at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('Home → Done → Log service → saved → the reminder is gone and the next one is scheduled', async ({
      page,
    }) => {
      const { vehicle, reminder, title } = await seedGarage(page);

      await page.goto('/home');
      const row = page.getByTestId('attention-row').filter({ hasText: title });
      await row.getByRole('button', { name: `Mark ${title} done` }).click();

      const dialog = page.getByRole('dialog', { name: `Done with ${title}?` });
      await expect(dialog.getByRole('link', { name: 'Log the service now' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Mark done without logging' })).toBeVisible();
      await shot(page, `done-dialog-${viewport.width}`);

      await dialog.getByRole('link', { name: 'Log the service now' }).click();
      await expect(page).toHaveURL(
        new RegExp(
          `/vehicles/${vehicle.id}/maintenance/new\\?category=engine_oil&reminderId=${reminder.id}$`,
        ),
      );

      // The form starts on the reminder's work, dated today; the record it
      // saves carries the reminder id, which is what completes the reminder.
      await expect(page.getByRole('button', { name: 'Oil change', pressed: true })).toBeVisible();
      await expect(page.getByText(`For your reminder “${title}”.`)).toBeVisible();
      const serviceDate = daysFromNow(0);
      await page.getByLabel('Odometer', { exact: true }).fill('15300');
      await page.getByLabel('Total on the bill').fill('2500');
      // The reminder's own rule, as its page promised, not the schedule's.
      await expect(page.getByTestId('next-due')).toContainText('25,300 km');
      await shot(page, `log-service-${viewport.width}`);
      await page.getByRole('button', { name: 'Save service' }).click();
      await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}\\?tab=history`));

      await page.goto('/home');
      await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
      await expect(page.getByTestId('attention-row').filter({ hasText: title })).toHaveCount(0);

      // Closed, and the next one counted from the record: 10,000 km on from its
      // reading, a year on from its date.
      const rows = await prisma.reminder.findMany({
        where: { vehicleId: vehicle.id, title },
        orderBy: { createdAt: 'asc' },
      });
      const nextYear = new Date(serviceDate);
      nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
      expect(
        rows.map((row) => ({
          status: row.status,
          dueOdometer: row.dueOdometer,
          dueDate: utcDay(row.dueDate),
          completed: row.completedAt !== null,
        })),
      ).toEqual([
        {
          status: 'completed',
          dueOdometer: 15000,
          dueDate: utcDay(daysFromNow(-2)),
          completed: true,
        },
        { status: 'upcoming', dueOdometer: 25300, dueDate: utcDay(nextYear), completed: false },
      ]);

      // The next one says where it came from on its page.
      await page.goto(`/reminders/${rows[1]!.id}`);
      await expect(page.getByTestId('reminder-next-step')).toHaveText(
        'Repeats every 10,000 km or 12 months; the next one will be counted from the service you log.',
      );
      await shot(page, `reminder-page-${viewport.width}`);
    });

    test('one Snooze on Home, Upcoming, the Reminders tab and the reminder page', async ({
      page,
    }) => {
      const { vehicle, reminder, title } = await seedGarage(page);
      const dueDateOf = async () =>
        utcDay((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).dueDate);

      // Home: a month.
      await page.goto('/home');
      await page
        .getByTestId('attention-row')
        .filter({ hasText: title })
        .getByRole('button', { name: `Snooze ${title}` })
        .click();
      let dialog = page.getByRole('dialog', { name: `Snooze ${title}` });
      await dialog.getByRole('radio', { name: '1 month' }).click();
      await expect(dialog.getByTestId('snooze-preview')).toContainText('Due again');
      // Kilometres move too: 500 km a week of the same span, from the odometer.
      await expect(dialog.getByTestId('snooze-preview')).toContainText(
        ' km, whichever comes first',
      );
      await shot(page, `snooze-dialog-home-${viewport.width}`);
      await dialog.getByRole('button', { name: 'Snooze', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const inAMonth = daysFromNow(0);
      inAMonth.setUTCMonth(inAMonth.getUTCMonth() + 1);
      await expect.poll(dueDateOf).toBe(utcDay(inAMonth));

      // Upcoming: its more menu opens the same dialog; a week on from its new date.
      await page.goto('/upcoming');
      const upcomingRow = page.getByTestId('upcoming-row').filter({ hasText: title });
      await upcomingRow.getByRole('button', { name: `More actions for ${title}` }).click();
      await page.getByRole('menuitem', { name: 'Snooze' }).click();
      dialog = page.getByRole('dialog', { name: `Snooze ${title}` });
      await expect(dialog.getByRole('radio', { name: '1 week' })).toBeChecked();
      await dialog.getByRole('button', { name: 'Snooze', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const plusWeek = new Date(inAMonth);
      plusWeek.setUTCDate(plusWeek.getUTCDate() + 7);
      await expect.poll(dueDateOf).toBe(utcDay(plusWeek));

      // The vehicle's Reminders tab: the card's own Snooze.
      await page.goto(`/vehicles/${vehicle.id}?tab=reminders`);
      const card = page.getByTestId('reminder-actions').filter({
        has: page.getByRole('button', { name: `Snooze ${title}` }),
      });
      await expect(card.getByRole('button', { name: `Mark ${title} done` })).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await shot(page, `reminders-tab-${viewport.width}`);
      await card.getByRole('button', { name: `Snooze ${title}` }).click();
      dialog = page.getByRole('dialog', { name: `Snooze ${title}` });
      await dialog.getByRole('button', { name: 'Snooze', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const plusTwoWeeks = new Date(plusWeek);
      plusTwoWeeks.setUTCDate(plusTwoWeeks.getUTCDate() + 7);
      await expect.poll(dueDateOf).toBe(utcDay(plusTwoWeeks));

      // The reminder page.
      await page.goto(`/reminders/${reminder.id}`);
      await page.getByRole('button', { name: `Snooze ${title}` }).click();
      dialog = page.getByRole('dialog', { name: `Snooze ${title}` });
      await expect(dialog.getByRole('radio', { name: 'Pick a date' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Snooze', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const plusThreeWeeks = new Date(plusTwoWeeks);
      plusThreeWeeks.setUTCDate(plusThreeWeeks.getUTCDate() + 7);
      await expect.poll(dueDateOf).toBe(utcDay(plusThreeWeeks));
    });

    test('a renewal that follows a paper sends Done to Renew', async ({ page }) => {
      const { vehicle, short } = await seedGarage(page);
      const policy = await prisma.insurancePolicy.create({
        data: {
          vehicleId: vehicle.id,
          provider: `Renew Insurer ${short}`,
          endDate: daysFromNow(10),
        },
      });
      const renewal = await prisma.reminder.create({
        data: {
          vehicleId: vehicle.id,
          title: `Insurance renewal ${short}`,
          type: 'insurance',
          status: 'upcoming',
          dueDate: daysFromNow(10),
          insurancePolicyId: policy.id,
        },
      });

      await page.goto(`/reminders/${renewal.id}`);
      await expect(page.getByTestId('reminder-follows-paper')).toBeVisible();
      const renew = page.getByRole('main').getByRole('link', { name: 'Renew', exact: true });
      await expect(renew).toHaveAttribute(
        'href',
        new RegExp(`/vehicles/${vehicle.id}\\?tab=papers$`),
      );
      await expect(
        page.getByRole('main').getByRole('button', { name: /^snooze |^mark .* done$/i }),
      ).toHaveCount(0);
      await shot(page, `renewal-page-${viewport.width}`);

      await renew.click();
      await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}\\?tab=papers$`));
    });
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
