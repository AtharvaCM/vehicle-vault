import { expect, type Page } from '@playwright/test';

import { markUserEmailVerified } from './test-db';

type Credentials = {
  email: string;
  name: string;
  password: string;
};

/**
 * Registration leaves the account unverified, and an unverified session renders
 * the "Verify your email" screen on every route. Verify out of band, then sign
 * in properly so the test lands on a usable dashboard.
 */
export async function registerAndSignIn(page: Page, { email, name, password }: Credentials) {
  await page.goto('/register');
  await page.getByLabel(/^name$/i).fill(name);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
  await markUserEmailVerified(email);

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}
