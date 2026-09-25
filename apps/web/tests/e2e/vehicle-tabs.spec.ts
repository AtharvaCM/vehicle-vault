import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Midnight UTC, `days` from today: how the API stores a document's dates. */
function utcDay(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

async function vehicleWithExpiredInsurance(page: Page, label: string) {
  const suffix = uniqueSuffix();
  const nickname = `Tabs ${label} ${suffix.slice(-4)}`;
  const provider = `Lapsed Insurer ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Tabs ${suffix}`,
    email: `e2e+tabs${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '18500',
    registrationNumber: `MH12TB${suffix.slice(-4)}`,
  });
  const vehicleUrl = new URL(page.url()).pathname;
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  await prisma.insurancePolicy.create({
    data: {
      vehicleId: vehicle.id,
      provider,
      policyNumber: `POL${suffix.slice(-6)}`,
      startDate: utcDay(-370),
      endDate: utcDay(-5),
      premiumAmount: 14_500,
    },
  });

  return { vehicleUrl, provider };
}

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`the vehicle page's five tabs fit and open on a ${viewport.name}`, async ({ page }) => {
    test.slow();
    const { vehicleUrl, provider } = await vehicleWithExpiredInsurance(page, viewport.name);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(vehicleUrl);

    const strip = page.getByRole('tablist', { name: 'Vehicle sections' });
    const tabs = strip.getByRole('tab');
    await expect(tabs).toHaveText(['Overview', 'History', 'Reminders', /^Papers/, 'More']);

    // Every tab on screen, with nothing to scroll to: not the strip, not the page.
    const fit = await strip.evaluate((list) => ({
      overflow: list.scrollWidth - list.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      rightEdges: [...list.querySelectorAll('[role="tab"]')].map(
        (tab) => tab.getBoundingClientRect().right,
      ),
    }));
    expect(fit.overflow).toBeLessThanOrEqual(0);
    expect(fit.pageOverflow).toBeLessThanOrEqual(0);
    for (const right of fit.rightEdges) expect(right).toBeLessThanOrEqual(viewport.width);

    // The lapsed policy puts a dot on Papers, and a screen reader hears why.
    await expect(strip.getByRole('tab', { name: 'Papers, 1 paper expired' })).toBeVisible();

    // The header: plate, name, odometer line, and the owner's actions.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tabs');
    await expect(page.getByText(/18,500 km, updated today/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Show papers' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Log' })).toBeVisible();

    // Overview is a status page: what needs attention, then how the vehicle stands.
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This vehicle' })).toBeVisible();

    await tabs.filter({ hasText: 'History' }).click();
    await expect(page).toHaveURL(/\?tab=history$/);
    await expect(page.getByRole('radio', { name: 'Service' })).toBeChecked();
    await expect(page.getByText('Service history baseline')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No service records yet' })).toBeVisible();
    await page.getByRole('radio', { name: 'Fuel' }).click();
    await expect(page).toHaveURL(/\?tab=history&view=fuel$/);
    await expect(page.getByRole('heading', { name: 'Fuel history' })).toBeVisible();

    await tabs.filter({ hasText: 'Reminders' }).click();
    await expect(page).toHaveURL(/\?tab=reminders$/);
    await expect(page.getByRole('heading', { name: 'No reminders yet' })).toBeVisible();

    await tabs.filter({ hasText: 'Papers' }).click();
    await expect(page).toHaveURL(/\?tab=papers$/);
    await expect(page.getByText(provider).first()).toBeVisible();

    await tabs.filter({ hasText: 'More' }).click();
    await expect(page).toHaveURL(/\?tab=more$/);
    const sections = page.getByRole('navigation', { name: 'More about this vehicle' });
    await expect(sections.getByRole('link')).toHaveCount(6);
    await sections.getByRole('link', { name: /^Tyres/ }).click();
    await expect(page).toHaveURL(/\?tab=more&section=tyres$/);
    await expect(page.getByRole('heading', { name: 'Tyres', exact: true })).toBeVisible();
    // Back, from a section, is the list.
    await page.goBack();
    await expect(page).toHaveURL(/\?tab=more$/);
    await expect(sections).toBeVisible();

    await tabs.filter({ hasText: 'Overview' }).click();
    await expect(page).toHaveURL(new RegExp(`${vehicleUrl}$`));
  });
}

test('links to the eleven old tabs open where each one went', async ({ page }) => {
  test.slow();
  const { vehicleUrl, provider } = await vehicleWithExpiredInsurance(page, 'legacy');
  const strip = page.getByRole('tablist', { name: 'Vehicle sections' });

  const moves = [
    ['maintenance', '?tab=history', 'History'],
    ['fuel', '?tab=history&view=fuel', 'History'],
    ['protection', '?tab=papers', 'Papers'],
    ['tyres', '?tab=more&section=tyres', 'More'],
    ['activity', '?tab=more&section=activity', 'More'],
  ] as const;

  for (const [old, now, tab] of moves) {
    await page.goto(`${vehicleUrl}?tab=${old}`);
    await expect(page).toHaveURL(`${vehicleUrl}${now}`);
    await expect(strip.getByRole('tab', { name: new RegExp(`^${tab}`) })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }

  // The Papers tab after a redirect is the real one, not an empty shell.
  await page.goto(`${vehicleUrl}?tab=protection`);
  await expect(page.getByText(provider).first()).toBeVisible();
});
