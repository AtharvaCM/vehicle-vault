import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

const DESKTOP = { width: 1440, height: 900 };

async function signIn(page: Page, label: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e+${label.toLowerCase()}${suffix}@vehiclevault.dev`;
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email,
    password: 'VehicleVault!234',
  });
  return email;
}

test('an admin reaches Users and Catalog curation from the account menu', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const email = await signIn(page, 'Admin');
  // The API reads the role from the database on every request, and the app
  // re-reads the account on load.
  await prisma.user.update({ where: { email }, data: { role: 'admin' } });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /^(Home|Welcome)/ })).toBeVisible();

  await page.getByRole('button', { name: /^Account menu for / }).click();
  await page.getByRole('menuitem', { name: 'Admin' }).click();

  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  const sections = page.getByRole('navigation', { name: 'Admin sections' });
  await expect(sections.getByRole('link')).toHaveText(['Users', 'Catalog curation']);
  // The directory lists this admin's own account.
  await expect(page.getByRole('main').getByText(email)).toBeVisible();

  await sections.getByRole('link', { name: 'Catalog curation' }).click();
  await expect(page).toHaveURL(/\/admin\/catalog$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog curation' })).toBeVisible();
  // The review card from #200, with its staged runs (none on a fresh database).
  await expect(page.getByRole('main').getByText('Catalog review', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Admin');

  // Settings is the owner's own account again: no curation there.
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Catalog review', { exact: true })).toHaveCount(0);
});

test('a non-admin is sent Home from /admin and never offered it', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await signIn(page, 'NotAdmin');

  for (const path of ['/admin', '/admin/users', '/admin/catalog']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
  }

  await page.getByRole('button', { name: /^Account menu for / }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Catalog curation' })).toHaveCount(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
