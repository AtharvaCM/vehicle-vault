import { expect, test, type Browser } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PASSWORD = 'VehicleVault!234';
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

/**
 * #298: the invite dialog explains each role in plain words and names the
 * owner-only actions, the share sheet leads the invite-link actions (WhatsApp
 * and Copy where it isn't available, as in a headless browser), pending
 * invites show who and when and can be copied again or revoked, and the
 * invitee's preview explains the role before they sign in. Checked at both
 * phone and desktop widths, since the role explanations and the action row
 * wrap differently at each.
 */
for (const size of [DESKTOP, PHONE]) {
  const label = size === DESKTOP ? 'desktop (1440)' : 'phone (390)';

  test(`owner invites, copies the link, revokes; the invitee's preview explains the role — ${label}`, async ({
    page,
    browser,
  }) => {
    test.slow();
    // The real clipboard is flaky under automation (permission grants and
    // document-focus timing vary run to run); stub `writeText` instead and
    // record what the app actually asked to copy.
    await page.addInitScript(() => {
      const w = window as unknown as { __copiedTexts: string[] };
      w.__copiedTexts = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (text: string) => {
            w.__copiedTexts.push(text);
            return Promise.resolve();
          },
        },
        configurable: true,
      });
    });
    // The toast text is identical for every copy, so waiting on it can catch a
    // still-visible toast from an earlier click; wait on the stub array
    // actually growing instead, then read what it was given.
    async function waitForNthCopy(n: number) {
      await page.waitForFunction(
        (count) => (window as unknown as { __copiedTexts: string[] }).__copiedTexts.length >= count,
        n,
      );
      return page.evaluate(
        (index) => (window as unknown as { __copiedTexts: string[] }).__copiedTexts[index],
        n - 1,
      );
    }

    const suffix = uniqueSuffix();
    const inviteeEmail = `e2e+roles${suffix}@vehiclevault.dev`;
    const nickname = `Roles ${suffix.slice(-4)}`;

    // Registration and vehicle creation need a comfortable width regardless
    // of the size under test.
    await page.setViewportSize(DESKTOP);
    await registerAndSignIn(page, {
      name: `E2E Roles Owner ${suffix}`,
      email: `e2e+roles-owner${suffix}@vehiclevault.dev`,
      password: PASSWORD,
    });
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname,
      odometer: '12000',
      registrationNumber: `MH12RO${suffix.slice(-4)}`,
    });

    await page.setViewportSize(size);
    await page.goto(`${vehicleUrl}?tab=more&section=members`);

    // The dialog explains each role in plain words and names owner-only actions.
    await expect(page.getByText('Sees papers, history and reminders.'), label).toBeVisible();
    await expect(
      page.getByText(/can also log services, fuel and papers/i).first(),
      label,
    ).toBeVisible();
    await expect(
      page.getByText(/can invite people, change roles, remove members or transfer ownership/i),
      label,
    ).toBeVisible();

    await page.getByLabel('Email', { exact: true }).fill(inviteeEmail);
    await page.getByRole('button', { name: 'Send invite' }).click();

    await expect(page.getByText(`Send this link to ${inviteeEmail}.`), label).toBeVisible();
    const link = await page.getByLabel('Invite link').inputValue();
    expect(link).toMatch(/\/vehicle-invites\/[0-9a-f]{64}$/);

    // Share, WhatsApp, Copy: the native share sheet isn't available in a
    // headless browser, so WhatsApp leads what does render. The invite is
    // already pending, so its row in Pending invitations renders underneath
    // this panel — scope to the panel (role="status") to find its own button.
    const linkPanel = page.getByRole('status');
    await expect(linkPanel.getByRole('button', { name: /^share$/i }), label).toHaveCount(0);
    await expect(linkPanel.getByRole('link', { name: /whatsapp/i }), label).toBeVisible();
    await linkPanel.getByRole('button', { name: /copy link/i }).click();
    await expect(page.getByText('Invite link copied'), label).toBeVisible();
    expect(await waitForNthCopy(1), label).toBe(link);

    await linkPanel.getByRole('button', { name: 'Done' }).click();

    // Pending invites: who (the email) and when (invited), copyable again.
    await expect(page.getByText(inviteeEmail), label).toBeVisible();
    await expect(page.getByText(/invited/i), label).toBeVisible();
    await page.getByRole('button', { name: /copy link/i }).click();
    const freshLink = await waitForNthCopy(2);
    // The first click's toast may still be visible when this one arrives.
    await expect(page.getByText('Invite link copied').last(), label).toBeVisible();
    expect(freshLink, label).toMatch(/\/vehicle-invites\/[0-9a-f]{64}$/);
    // Rotating the token means the first link the owner copied no longer works.
    expect(freshLink, label).not.toBe(link);

    // The invitee's preview explains the role, in the same words, before
    // they've signed in at all.
    const invitePath = new URL(freshLink!).pathname;
    const invitee = await freshPage(browser);
    await invitee.setViewportSize(size);
    await invitee.goto(invitePath);
    await expect(
      invitee.getByText(/can also log services, fuel and papers/i).first(),
      label,
    ).toBeVisible();

    // Revoke: the pending invite disappears, and the link stops working.
    await page.getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('Invitation revoked'), label).toBeVisible();
    await expect(page.getByText(inviteeEmail), label).toHaveCount(0);

    await invitee.reload();
    await expect(invitee.getByText('This invite was cancelled').first(), label).toBeVisible();
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});
