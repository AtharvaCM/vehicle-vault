import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };
/** The smallest target a thumb hits reliably (WCAG 2.5.5, and the design language). */
const MIN_TARGET = 44;

type Target = { name: string; width: number; height: number };

/**
 * Every visible button, switch and menu trigger on the page, with the box a tap
 * lands in: the element's own box, grown by a `::before` hit area where a
 * small control draws one (the switch does).
 */
async function tapTargets(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const selector = 'button, [role="switch"], [role="tab"], [aria-haspopup="menu"]';

    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 1 &&
          box.height > 1 &&
          style.visibility !== 'hidden' &&
          !element.closest('[aria-hidden="true"], .sr-only')
        );
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        let { width, height } = box;
        const before = getComputedStyle(element, '::before');

        if (before.content !== 'none' && before.position === 'absolute') {
          const inset = (value: string) => (value.endsWith('px') ? parseFloat(value) : 0);
          width = Math.max(width, width - inset(before.left) - inset(before.right));
          height = Math.max(height, height - inset(before.top) - inset(before.bottom));
        }

        const name =
          element.getAttribute('aria-label') ||
          element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40) ||
          element.outerHTML.slice(0, 80);

        return { name, width: Math.round(width), height: Math.round(height) };
      });
  });
}

async function expectThumbSized(page: Page) {
  const targets = await tapTargets(page);
  expect(targets.length).toBeGreaterThan(0);

  const tooSmall = targets.filter(
    (target) => target.width < MIN_TARGET || target.height < MIN_TARGET,
  );
  expect(tooSmall, 'targets under 44 × 44 px at 390 px wide').toEqual([]);
}

test.describe('touch targets on a phone', () => {
  test.beforeEach(async ({ page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerAndSignIn(page, {
      name: `E2E Targets ${suffix}`,
      email: `e2e+targets${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    await createCatalogVehicle(page, {
      nickname: `Targets ${suffix.slice(-4)}`,
      odometer: '15200',
      registrationNumber: `MH12TT${suffix.slice(-4)}`,
    });
    await page.setViewportSize(PHONE);
  });

  test('home: buttons and the vehicle row menu are at least 44 px', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('vehicle-health-card').first()).toBeVisible();

    await expectThumbSized(page);
  });

  test('vehicle page: header actions and tabs are at least 44 px', async ({ page }) => {
    // createCatalogVehicle leaves the page on the new vehicle.
    await page.reload();
    await expect(page.getByRole('button', { name: 'More vehicle actions' })).toBeVisible();

    await expectThumbSized(page);
  });

  test('preferences: switches are at least 44 px to tap', async ({ page }) => {
    await page.goto('/settings/preferences');
    await expect(page.getByRole('switch').first()).toBeVisible();

    await expectThumbSized(page);
  });
});
