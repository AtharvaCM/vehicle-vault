import { createHash } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { registerUnverified } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const DAY_MS = 24 * 60 * 60 * 1000;

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function newAccount() {
  const suffix = uniqueSuffix();
  return {
    suffix,
    name: `E2E Unverified ${suffix}`,
    email: `e2e+unverified${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  };
}

function verificationBanner(page: Page) {
  return page.getByRole('status').filter({ hasText: /verify your email/i });
}

test('a new account uses the app for a week before it has to verify', async ({ page }) => {
  const account = newAccount();
  const nickname = `Grace ${account.suffix.slice(-4)}`;
  const workshopName = `Grace Workshop ${account.suffix.slice(-4)}`;

  await registerUnverified(page, account);

  await expect(verificationBanner(page)).toContainText('7 days left');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber: `MH12GR${account.suffix.slice(-4)}`,
  });

  await page
    .getByRole('link', { name: /log maintenance/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/maintenance\/new$/);
  await page.getByLabel(/service date/i).fill('2026-03-20');
  await page.getByLabel(/^odometer$/i).fill('15200');
  await page.getByLabel(/workshop or garage/i).fill(workshopName);
  await page.getByLabel(/total cost/i).fill('4500');
  await page.getByRole('button', { name: /save record/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/maintenance$/);
  await expect(page.getByText(workshopName)).toBeVisible();

  // Day eight: the account is a week and a day old and still unverified.
  await prisma.user.update({
    where: { email: account.email },
    data: { createdAt: new Date(Date.now() - 8 * DAY_MS) },
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
  await expect(page.getByText(workshopName)).toHaveCount(0);
});

test('following the email link while signed in keeps the session', async ({ page }) => {
  const account = newAccount();
  await registerUnverified(page, account);
  await expect(verificationBanner(page)).toBeVisible();

  // Stand in for the emailed link: the API stores only a hash of its token.
  const token = `e2e-verification-${account.suffix}`;
  await prisma.user.update({
    where: { email: account.email },
    data: {
      emailVerificationTokenHash: createHash('sha256').update(token).digest('hex'),
      emailVerificationTokenExpiresAt: new Date(Date.now() + DAY_MS),
    },
  });

  await page.goto(`/verify-email?token=${token}`);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(verificationBanner(page)).toHaveCount(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
