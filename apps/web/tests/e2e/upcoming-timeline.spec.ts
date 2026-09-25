import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

// Fixed titles the API always uses for a document/EMI row, regardless of who owns it.
const PAPER_TITLE = 'Insurance policy';
const PUC_TITLE = 'PUC certificate';
const ROAD_TAX_TITLE = 'Road tax';
const EMI_TITLE = 'Loan EMI';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

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

/**
 * `offsetMonths` months from today, clamped to the target month's last day —
 * the same trick `seed-demo.ts` uses to land a loan's next EMI within a week.
 */
function monthsFromNow(offsetMonths: number, dayOfMonth?: number): Date {
  const today = atNoonUtc(new Date());
  const targetDay = dayOfMonth ?? today.getUTCDate();
  const date = new Date(today);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offsetMonths);
  const daysInTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(targetDay, daysInTargetMonth));
  return date;
}

type SeededTimeline = {
  vehicleA: { id: string; nickname: string };
  vehicleB: { id: string; nickname: string };
  titles: { overdue: string; serviceSoon: string; secondService: string };
};

/**
 * Two vehicles across every Upcoming group: an overdue reminder and a
 * this-week reminder/paper/EMI on the first, a this-month reminder on the
 * second, and two later papers. Every date is relative to now, so the spec
 * never rots.
 */
async function seedTimeline(email: string, suffix: string): Promise<SeededTimeline> {
  const user = await prisma.user.findFirstOrThrow({ where: { email: email.toLowerCase() } });
  const short = suffix.slice(-4);
  const today = atNoonUtc(new Date());
  // Lands the loan's next EMI within ~1-7 days of today, as in seed-demo.ts.
  const loanInstallmentDay = ((today.getUTCDate() + 1) % 28) + 1;

  const titles = {
    overdue: `Overdue insurance ${short}`,
    serviceSoon: `Brake service ${short}`,
    secondService: `Second vehicle service ${short}`,
  };

  const vehicleA = await prisma.vehicle.create({
    data: {
      userId: user.id,
      registrationNumber: `MH12UA${short}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      fuelType: 'petrol',
      vehicleType: 'suv',
      nickname: `Timeline A ${short}`,
      odometer: 15000,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });

  // Overdue: Late.
  await prisma.reminder.create({
    data: {
      vehicleId: vehicleA.id,
      title: titles.overdue,
      type: 'insurance',
      status: 'overdue',
      dueDate: daysFromNow(-3),
    },
  });
  // Due in 3 days: This week.
  await prisma.reminder.create({
    data: {
      vehicleId: vehicleA.id,
      title: titles.serviceSoon,
      type: 'service',
      status: 'upcoming',
      dueDate: daysFromNow(3),
    },
  });
  // Ends in 5 days: This week.
  await prisma.insurancePolicy.create({
    data: {
      vehicleId: vehicleA.id,
      provider: `Timeline Insurer ${short}`,
      endDate: daysFromNow(5),
    },
  });
  // Ends in 200 days: Later.
  await prisma.complianceDocument.create({
    data: { vehicleId: vehicleA.id, kind: 'puc', endDate: daysFromNow(200) },
  });
  // Ends in 45 days: Later.
  await prisma.complianceDocument.create({
    data: { vehicleId: vehicleA.id, kind: 'road_tax', endDate: daysFromNow(45) },
  });

  const vehicleB = await prisma.vehicle.create({
    data: {
      userId: user.id,
      registrationNumber: `MH12UB${short}`,
      make: 'Maruti Suzuki',
      model: 'Swift',
      year: 2023,
      fuelType: 'petrol',
      vehicleType: 'car',
      nickname: `Timeline B ${short}`,
      odometer: 32000,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });

  // Due in 20 days: This month.
  await prisma.reminder.create({
    data: {
      vehicleId: vehicleB.id,
      title: titles.secondService,
      type: 'service',
      status: 'upcoming',
      dueDate: daysFromNow(20),
    },
  });

  // Next EMI within 1-7 days: This week.
  await prisma.vehicleLoan.create({
    data: {
      vehicleId: vehicleB.id,
      lender: 'HDFC Bank',
      principal: 150000,
      interestRate: 9.5,
      tenureMonths: 36,
      startDate: monthsFromNow(-6, loanInstallmentDay),
      emiAmount: 4800,
      status: 'active',
    },
  });

  return {
    vehicleA: { id: vehicleA.id, nickname: vehicleA.nickname! },
    vehicleB: { id: vehicleB.id, nickname: vehicleB.nickname! },
    titles,
  };
}

async function registerAndSeed(page: Page): Promise<SeededTimeline> {
  const suffix = uniqueSuffix();
  const email = `e2eupcoming+${suffix}@vehiclevault.dev`;

  await registerAndSignIn(page, {
    name: `E2E Upcoming ${suffix}`,
    email,
    password: 'VehicleVault!234',
  });

  return seedTimeline(email, suffix);
}

for (const viewport of VIEWPORTS) {
  test.describe(`Upcoming timeline at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('shows Late/This week/This month/Later with the right rows, and Home agrees', async ({
      page,
    }) => {
      const { titles } = await registerAndSeed(page);

      await page.goto('/upcoming');

      const lateGroup = page.getByTestId('upcoming-group-late');
      const weekGroup = page.getByTestId('upcoming-group-this_week');
      const monthGroup = page.getByTestId('upcoming-group-this_month');
      const laterGroup = page.getByTestId('upcoming-group-later');

      await expect(lateGroup.getByText(titles.overdue)).toBeVisible();
      await expect(lateGroup.getByTestId('upcoming-row')).toHaveCount(1);

      await expect(weekGroup.getByText(titles.serviceSoon)).toBeVisible();
      await expect(weekGroup.getByText(PAPER_TITLE)).toBeVisible();
      await expect(weekGroup.getByText(EMI_TITLE)).toBeVisible();
      await expect(weekGroup.getByTestId('upcoming-row')).toHaveCount(3);

      await expect(monthGroup.getByText(titles.secondService)).toBeVisible();
      await expect(monthGroup.getByTestId('upcoming-row')).toHaveCount(1);

      // The PUC row's own noun label repeats its title ("PUC certificate"),
      // so more than one match here is expected: `.first()` just confirms it renders.
      await expect(laterGroup.getByText(PUC_TITLE).first()).toBeVisible();
      await expect(laterGroup.getByText(ROAD_TAX_TITLE).first()).toBeVisible();
      await expect(laterGroup.getByTestId('upcoming-row')).toHaveCount(2);

      const lateAndWeekCount =
        (await lateGroup.getByTestId('upcoming-row').count()) +
        (await weekGroup.getByTestId('upcoming-row').count());

      // Home's "Needs attention" queue is overdue + today + this-week: exactly
      // what Upcoming calls Late + This week, read from the same classification.
      await page.goto('/home');
      await expect(page.getByTestId('attention-row').first()).toBeVisible();
      await expect(page.getByTestId('attention-row')).toHaveCount(lateAndWeekCount);
    });

    test('each row offers the verb that fixes it', async ({ page }) => {
      const { vehicleA, titles } = await registerAndSeed(page);

      await page.goto('/upcoming');

      const serviceRow = page.getByTestId('upcoming-row').filter({ hasText: titles.serviceSoon });
      // It opens the form on the reminder's category, naming the reminder it answers.
      await expect(serviceRow.getByRole('link', { name: 'Log service' })).toHaveAttribute(
        'href',
        new RegExp(
          `/vehicles/${vehicleA.id}/maintenance/new\\?category=periodic_service&reminderId=`,
        ),
      );

      const paperRow = page.getByTestId('upcoming-row').filter({ hasText: PAPER_TITLE });
      await expect(paperRow.getByRole('link', { name: 'Renew' })).toHaveAttribute(
        'href',
        /\?tab=papers$/,
      );

      const emiRow = page.getByTestId('upcoming-row').filter({ hasText: EMI_TITLE });
      await expect(emiRow.getByRole('link', { name: 'View loan' })).toBeVisible();
    });

    test('Done clears a late reminder, and Snooze moves the 3-day service reminder out of This week', async ({
      page,
    }) => {
      const { titles } = await registerAndSeed(page);

      await page.goto('/upcoming');

      const lateGroup = page.getByTestId('upcoming-group-late');
      const weekGroup = page.getByTestId('upcoming-group-this_week');

      const lateRow = lateGroup.getByTestId('upcoming-row').filter({ hasText: titles.overdue });
      await lateRow.getByRole('button', { name: `Mark ${titles.overdue} done` }).click();
      await expect(lateGroup.getByText(titles.overdue)).toHaveCount(0);

      const weekRow = weekGroup.getByTestId('upcoming-row').filter({ hasText: titles.serviceSoon });
      await weekRow.getByRole('button', { name: `More actions for ${titles.serviceSoon}` }).click();
      await page.getByRole('menuitem', { name: 'Snooze' }).click();
      // The shared Snooze dialog, on its default week.
      const snooze = page.getByRole('dialog', { name: `Snooze ${titles.serviceSoon}` });
      await expect(snooze.getByRole('radio', { name: '1 week' })).toBeChecked();
      await snooze.getByRole('button', { name: 'Snooze', exact: true }).click();

      // +7 days on a 3-day-out reminder lands 10 days out: no longer This
      // week, wherever it lands (This week or This month, per the note above).
      // Row-scoped, not a page-wide text match: the toast and the sr-only
      // announcement also repeat the title.
      await expect(weekGroup.getByText(titles.serviceSoon)).toHaveCount(0);
      await expect(
        page.getByTestId('upcoming-row').filter({ hasText: titles.serviceSoon }),
      ).toHaveCount(1);
    });

    test('filters live in the URL, survive a reload, and a vehicle choice updates it too', async ({
      page,
    }) => {
      const { vehicleA } = await registerAndSeed(page);

      await page.goto('/upcoming');

      await page.getByRole('radio', { name: 'Papers' }).click();
      await expect(page).toHaveURL(/[?&]kind=papers(&|$)/);

      const rows = page.getByTestId('upcoming-row');
      await expect(rows.first()).toBeVisible();
      const kinds = await rows.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-kind')),
      );
      expect(kinds.length).toBeGreaterThan(0);
      expect(kinds.every((kind) => kind === 'document')).toBe(true);

      await page.reload();
      await expect(page).toHaveURL(/[?&]kind=papers(&|$)/);
      await expect(page.getByRole('radio', { name: 'Papers' })).toHaveAttribute('data-state', 'on');

      await page.getByRole('radio', { name: 'All' }).click();
      await page.getByLabel('Vehicle').click();
      await page.getByRole('option', { name: new RegExp(vehicleA.nickname) }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]vehicle=${vehicleA.id}`));
    });

    if (viewport.width === 390) {
      test('has no sideways scroll on a phone', async ({ page }) => {
        await registerAndSeed(page);

        await page.goto('/upcoming');

        const noHorizontalScroll = await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        );
        expect(noHorizontalScroll).toBe(true);
      });
    }
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
