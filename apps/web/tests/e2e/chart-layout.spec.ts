import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function monthsAgo(months: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 12));
}

/** Every chart and share bar on the page, and whether any of it sticks out of its card or the screen. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return [
      ...document.querySelectorAll<HTMLElement>('[data-slot="chart"], [data-slot="share-bar"]'),
    ].map((element) => {
      const box = element.getBoundingClientRect();
      const card = element.closest<HTMLElement>('[data-slot="card"]')?.getBoundingClientRect();
      const svg = element.querySelector('svg')?.getBoundingClientRect();
      return {
        slot: element.dataset.slot,
        outOfScreen: box.right > viewport + 0.5 || box.left < -0.5,
        outOfCard: card ? box.right > card.right + 0.5 : false,
        svgWiderThanChart: svg ? svg.width > box.width + 0.5 : false,
      };
    });
  });
}

/**
 * The spend charts on a phone: readable, and inside their cards, including
 * straight after the window narrows. Recharts measures its container a moment
 * after a resize, so the check waits for that before looking.
 */
test('spend charts stay inside their cards at 390px, also after a resize', async ({ page }) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const nickname = `Charts ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Charts ${suffix}`,
    email: `e2e+charts${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '18500',
    registrationNumber: `MH12CH${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  // A few months of fuel and a service, so both charts have something to draw.
  await prisma.fuelLog.createMany({
    data: [5, 4, 3, 2, 1].map((months, index) => ({
      vehicleId: vehicle.id,
      date: monthsAgo(months),
      odometer: 16_000 + index * 500,
      quantity: 35,
      price: 104.5,
      totalCost: 3_657.5,
    })),
  });
  await prisma.maintenanceRecord.create({
    data: {
      vehicleId: vehicle.id,
      serviceDate: monthsAgo(2),
      odometer: 17_000,
      category: 'engine_oil',
      totalCost: 4_200,
    },
  });

  await page.setViewportSize(DESKTOP);
  await page.goto('/dashboard');
  const trend = page.getByRole('figure', { name: 'Spend each month, by category' });
  await expect(trend).toBeVisible();
  await expect(page.getByRole('group', { name: /Spend by category/ })).toBeVisible();

  // Narrow the window under the charts, then let Recharts remeasure.
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(1_000);
  for (const chart of await overflow(page)) {
    expect(chart, `${chart.slot} after narrowing`).toEqual(
      expect.objectContaining({ outOfScreen: false, outOfCard: false, svgWiderThanChart: false }),
    );
  }

  // A fresh load on a phone: the charts wait behind "Show spending".
  await page.goto('/dashboard');
  await page.getByText('Show spending').click();
  await expect(trend).toBeVisible();
  await page.waitForTimeout(1_000);
  const onPhone = await overflow(page);
  expect(onPhone.length).toBeGreaterThanOrEqual(2);
  for (const chart of onPhone) {
    expect(chart, `${chart.slot} on a phone`).toEqual(
      expect.objectContaining({ outOfScreen: false, outOfCard: false, svgWiderThanChart: false }),
    );
  }

  // Months read as people say them, not as ISO keys.
  await expect(
    trend
      .locator('svg')
      .getByText(/^[A-Z][a-z]{2} \d{4}$/)
      .first(),
  ).toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
