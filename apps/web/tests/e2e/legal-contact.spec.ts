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
      path: `${SHOTS}/legal-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #341: Privacy, Terms and Contact in the public frame, linked from the footer
 * and from sign-up; the Contact form stores the message, and an admin reads it
 * under Admin → Messages.
 */
for (const viewport of VIEWPORTS) {
  test(`Privacy, Terms and Contact, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Reached from the footer, in the public frame.
    await page.goto('/cars');
    const footer = page.getByRole('navigation', { name: 'Footer' });
    await footer.getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByTestId('public-frame')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'What we collect' })).toBeVisible();
    await shoot(page, 'privacy', viewport.width);

    await footer.getByRole('link', { name: 'Terms' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Terms' })).toBeVisible();

    // Sign-up points at both.
    await page.goto('/register');
    const terms = page.getByTestId('register-terms');
    await expect(terms.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    await expect(terms.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');

    // Contact: its own messages first, then sent and stored.
    await page.goto('/contact');
    await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Enter your name')).toBeVisible();
    await shoot(page, 'contact', viewport.width);

    const email = `e2e+contact${suffix}@example.test`;
    await page.getByLabel('Your name').fill(`E2E Contact ${suffix}`);
    await page.getByLabel('Email to reply to').fill(email);
    await page.getByLabel('Message').fill('The Creta page lists the wrong tyre size.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Thanks, it’s sent' })).toBeVisible();
    await expect.poll(() => prisma.contactMessage.count({ where: { email } })).toBe(1);
  });
}

test('an admin reads Contact messages under Admin → Messages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const sender = `e2e+sender${suffix}@example.test`;
  await prisma.contactMessage.create({
    data: { name: `Sender ${suffix}`, email: sender, message: 'Please add the Honda Shine 100.' },
  });
  const adminEmail = `e2e+msgadmin${suffix}@vehiclevault.dev`;
  await registerAndSignIn(page, {
    name: `E2E Admin ${suffix}`,
    email: adminEmail,
    password: 'VehicleVault!234',
  });
  await prisma.user.update({ where: { email: adminEmail }, data: { role: 'admin' } });

  await page.goto('/admin/users');
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Messages' })
    .click();
  await expect(page).toHaveURL(/\/admin\/messages$/);
  const message = page.getByTestId('admin-message').filter({ hasText: sender });
  await expect(message).toContainText('Please add the Honda Shine 100.');
  await expect(message.getByRole('link', { name: sender })).toHaveAttribute(
    'href',
    `mailto:${sender}`,
  );
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/legal-admin-messages-1440.png`,
      animations: 'disabled',
    });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
