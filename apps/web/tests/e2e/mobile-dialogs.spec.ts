import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 375, height: 812 };
/** Roughly what is left of that phone above an on-screen keyboard. */
const PHONE_WITH_KEYBOARD = { width: 375, height: 480 };
const TABLET = { width: 1024, height: 768 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Signs in, adds a vehicle, and returns its Protection tab's address. */
async function vehicleProtectionTab(page: Page, label: string) {
  const suffix = uniqueSuffix();
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+${label.toLowerCase()}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname: `${label} Garage ${suffix.slice(-4)}`,
    odometer: '15200',
    registrationNumber: `MH12DG${suffix.slice(-4)}`,
  });
  return `${page.url()}?tab=protection`;
}

/**
 * A centred desktop modal on a phone is a cramped box with the keyboard over
 * it. Below md every dialog is a bottom sheet instead; from md it is the modal
 * it always was. jsdom cannot evaluate a breakpoint, so the sheet is measured
 * here, in a real browser.
 */
test('a dialog rises from the bottom of a phone, with Save in reach', async ({ page }) => {
  const protection = await vehicleProtectionTab(page, 'Sheet');
  await page.setViewportSize(PHONE);
  await page.goto(protection);

  await page.getByRole('button', { name: /add policy/i }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // Let the slide-in finish before measuring.
  await page.waitForTimeout(400);

  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.x)).toBe(0);
  expect(Math.round(box!.width)).toBe(PHONE.width);
  expect(Math.round(box!.y + box!.height)).toBe(PHONE.height);

  // With a keyboard up, the policy form is taller than the space left: the
  // sheet shrinks to fit and scrolls within itself…
  await page.setViewportSize(PHONE_WITH_KEYBOARD);
  await sheet.getByLabel('Notes').focus();
  // The resize reaches the sheet through a visual-viewport event, so wait for it
  // to settle: the whole sheet on screen, resting on the bottom edge.
  await expect
    .poll(async () => {
      const fitted = await sheet.boundingBox();
      return fitted ? [Math.round(fitted.y) >= 0, Math.round(fitted.y + fitted.height)] : null;
    })
    .toEqual([true, PHONE_WITH_KEYBOARD.height]);
  expect(await sheet.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);

  // …and the primary action stays on screen wherever the form is scrolled to.
  const save = sheet.getByRole('button', { name: /^add policy$/i });
  const onScreen = async () => {
    const button = await save.boundingBox();
    return Boolean(
      button && button.y >= 0 && button.y + button.height <= PHONE_WITH_KEYBOARD.height,
    );
  };
  await sheet.evaluate((node) => node.scrollTo({ top: 0 }));
  expect(await onScreen()).toBe(true);
  // Pinned flush to the bottom edge: no strip below it for the form to scroll
  // through underneath the buttons.
  const footer = sheet.locator('div:has(> button[type="submit"])');
  const footerBox = await footer.boundingBox();
  expect(Math.round(footerBox!.y + footerBox!.height)).toBe(PHONE_WITH_KEYBOARD.height);
  await sheet.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
  expect(await onScreen()).toBe(true);

  // Escape still closes it, as it does on desktop.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('from md up a dialog is the centred modal it was', async ({ page }) => {
  const protection = await vehicleProtectionTab(page, 'Modal');
  await page.setViewportSize(TABLET);
  await page.goto(protection);

  await page.getByRole('button', { name: /add policy/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await page.waitForTimeout(400);

  const box = await modal.boundingBox();
  expect(box).not.toBeNull();
  // Clear of every edge, and centred horizontally.
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.y + box!.height).toBeLessThan(TABLET.height);
  expect(Math.abs(box!.x + box!.width / 2 - TABLET.width / 2)).toBeLessThanOrEqual(1);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
