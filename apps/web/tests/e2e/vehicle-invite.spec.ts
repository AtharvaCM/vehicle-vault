import { expect, test, type Browser, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PASSWORD = 'VehicleVault!234';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** An owner with a vehicle invites `email`, and gets the link to send (no mail here). */
async function ownerInvites(page: Page, email: string, suffix: string) {
  const nickname = `Invite ${suffix.slice(-4)}`;
  await registerAndSignIn(page, {
    name: `E2E Owner ${suffix}`,
    email: `e2e+invite-owner${suffix}@vehiclevault.dev`,
    password: PASSWORD,
  });
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber: `MH12IV${suffix.slice(-4)}`,
  });

  await page.getByRole('tab', { name: 'Members' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send invite' }).click();

  // Email is not configured here: the page hands over the link and says so.
  await expect(page.getByText(`Send this link to ${email}.`)).toBeVisible();
  const link = await page.getByLabel('Invite link').inputValue();
  expect(link).toMatch(/\/vehicle-invites\/[0-9a-f]{64}$/);

  return { nickname, vehicleUrl, invitePath: new URL(link).pathname };
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test('a signed-out invitee previews the invite, registers and accepts it', async ({
  page,
  browser,
}) => {
  const suffix = uniqueSuffix();
  const inviteeEmail = `e2e+invitee${suffix}@vehiclevault.dev`;
  const { nickname, vehicleUrl, invitePath } = await ownerInvites(page, inviteeEmail, suffix);

  const invitee = await freshPage(browser);
  await invitee.goto(invitePath);

  // A preview, not an automatic accept, and no sign-in wall in front of it.
  await expect(invitee).toHaveURL(new RegExp(`${invitePath}$`));
  await expect(invitee.getByText(/can edit/i).first()).toBeVisible();
  await expect(invitee.getByText('e***@vehiclevault.dev').first()).toBeVisible();

  await invitee.getByRole('link', { name: 'Create account to accept' }).click();
  await expect(invitee).toHaveURL(/\/register\?next=/);
  await invitee.getByLabel(/^name$/i).fill(`E2E Invitee ${suffix}`);
  await invitee.getByLabel(/email address/i).fill(inviteeEmail);
  await invitee.getByLabel(/^password$/i).fill(PASSWORD);
  await invitee.getByRole('button', { name: /create account/i }).click();

  // Back on the invite, signed in as the invited address: accept explicitly.
  await expect(invitee).toHaveURL(new RegExp(`${invitePath}$`));
  await invitee.getByRole('button', { name: 'Accept invitation' }).click();

  await expect(invitee).toHaveURL(new URL(vehicleUrl).pathname);
  await expect(invitee.getByRole('heading', { name: nickname })).toBeVisible();
});

test('another account is told the invite is not for it, and the invitee can decline', async ({
  page,
  browser,
  request,
}) => {
  const suffix = uniqueSuffix();
  const inviteeEmail = `e2e+decliner${suffix}@vehiclevault.dev`;
  const { invitePath } = await ownerInvites(page, inviteeEmail, suffix);

  for (const email of [inviteeEmail, `e2e+stranger${suffix}@vehiclevault.dev`]) {
    const response = await request.post('/api/auth/register', {
      data: { name: `E2E ${suffix}`, email, password: PASSWORD },
    });
    expect(response.ok()).toBe(true);
  }

  const other = await freshPage(browser);
  await other.goto(`/login?next=${encodeURIComponent(invitePath)}`);
  await other.getByLabel(/email address/i).fill(`e2e+stranger${suffix}@vehiclevault.dev`);
  await other.getByLabel(/^password$/i).fill(PASSWORD);
  await other.getByRole('button', { name: /^sign in$/i }).click();

  await expect(other).toHaveURL(new RegExp(`${invitePath}$`));
  await expect(other.getByText('This invite is for another account').first()).toBeVisible();
  await expect(other.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);

  await other.getByRole('button', { name: 'Sign out and switch account' }).click();
  await expect(other).toHaveURL(/\/login\?next=/);
  await other.getByLabel(/email address/i).fill(inviteeEmail);
  await other.getByLabel(/^password$/i).fill(PASSWORD);
  await other.getByRole('button', { name: /^sign in$/i }).click();

  await expect(other).toHaveURL(new RegExp(`${invitePath}$`));
  await other.getByRole('button', { name: 'Decline' }).click();
  await expect(other.getByText('This invite was declined').first()).toBeVisible();

  const invite = await prisma.vehicleInvite.findFirstOrThrow({ where: { email: inviteeEmail } });
  expect(invite.declinedAt).not.toBeNull();
  expect(invite.acceptedAt).toBeNull();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
