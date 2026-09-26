import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/settings-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

async function signIn(page: Page, label: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e+${label.toLowerCase()}${suffix}@vehiclevault.dev`;
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email,
    password: 'VehicleVault!234',
  });
  return { email, suffix };
}

/**
 * #372: the account's name can be changed from Settings; the stored-file
 * check is an admin's tool; notification preferences set up the device
 * before the per-alert switches that depend on it.
 */
for (const viewport of VIEWPORTS) {
  test(`Settings and preferences, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { suffix } = await signIn(page, 'Settings');
    const main = page.getByRole('main');

    await page.goto('/settings');
    await expect(main.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(main.getByRole('button', { name: /check files/i })).toHaveCount(0);
    await expect(main.getByText('Stored files')).toHaveCount(0);

    const nameRow = main.getByTestId('settings-row').filter({ hasText: /^Name/ });
    await nameRow.getByRole('button', { name: 'Edit' }).click();
    const field = main.getByLabel('Name', { exact: true });
    await field.fill(`Asha ${suffix}`);
    await shoot(page, 'name-edit', viewport.width);
    await main.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(main.getByTestId('settings-row').filter({ hasText: /^Name/ })).toContainText(
      `Asha ${suffix}`,
    );
    await page.reload();
    await expect(main.getByTestId('settings-row').filter({ hasText: /^Name/ })).toContainText(
      `Asha ${suffix}`,
    );

    await page.goto('/settings/preferences');
    const device = main.getByText('This device', { exact: true });
    const alerts = main.getByText('Alerts', { exact: true });
    await expect(device).toBeVisible();
    expect((await device.boundingBox())!.y, 'This device comes first').toBeLessThan(
      (await alerts.boundingBox())!.y,
    );
    await shoot(page, 'preferences', viewport.width);
  });
}

/**
 * #372: the users list says whether each email is verified and when each
 * account last signed in, and an admin's own row offers no Force sign-out.
 */
test('the admin users list: verified, last sign-in, and no Force sign-out on your own row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email } = await signIn(page, 'AdminGaps');
  await prisma.user.update({ where: { email }, data: { role: 'admin' } });

  await page.goto('/admin/users');
  await page.getByPlaceholder('Search by email or name').fill(email);
  const own = page.getByRole('main').getByRole('listitem').filter({ hasText: email });
  await expect(own).toBeVisible();
  await expect(own).toContainText('You');
  await expect(own).toContainText(/Verified|Not verified/);
  await expect(own.getByTestId('admin-user-last-sign-in')).toContainText('Last signed in');
  await expect(own.getByRole('button', { name: /force sign-out/i })).toHaveCount(0);
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/settings-admin-users-1440.png`, fullPage: true });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
