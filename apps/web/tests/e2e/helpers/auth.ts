import { expect, type Page } from '@playwright/test';

import { markUserEmailVerified } from './test-db';

type Credentials = {
  email: string;
  name: string;
  password: string;
};

/**
 * Registers through the form. The new account is signed straight in, unverified
 * and inside its week of grace, on the add-vehicle form (#346); this goes on to
 * Home, where the setup checklist welcomes it.
 */
export async function registerUnverified(page: Page, { email, name, password }: Credentials) {
  await page.goto('/register');
  await page.getByLabel(/^your name$/i).fill(name);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/new$/);
  await page.goto('/home');
  await expect(page.getByRole('heading', { level: 1, name: /^Welcome/ })).toBeVisible();
}

/**
 * The verification link only arrives by email, which the e2e environment
 * deliberately cannot receive. Verify out of band so suites run as a settled
 * account, then reload so the session picks the verified account up.
 */
export async function registerAndSignIn(page: Page, credentials: Credentials) {
  await registerUnverified(page, credentials);
  await markUserEmailVerified(credentials.email);

  await page.reload();
  await expect(page.getByTestId('setup-checklist')).toBeVisible();
}
