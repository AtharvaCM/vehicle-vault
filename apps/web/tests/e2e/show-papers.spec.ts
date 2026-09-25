import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const receiptPdf = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sample-receipt.pdf',
);

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function utcDay(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

/** A phone photo of a policy: a real JPEG, large enough that the saved copy is shrunk. */
async function policyPhoto(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f4efe2';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#15181e';
    context.font = 'bold 120px sans-serif';
    context.fillText('POLICY SCHEDULE', 160, 320);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  });
  return { name: 'policy.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

/** The vehicle ids this browser holds saved papers for. */
function savedVehicleIds(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open('vehicle-vault-papers');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('papers')) {
            db.close();
            resolve([]);
            return;
          }
          const keys = db.transaction('papers').objectStore('papers').getAllKeys();
          keys.onsuccess = () => {
            db.close();
            resolve(keys.result as string[]);
          };
          keys.onerror = () => reject(keys.error);
        };
      }),
  );
}

type Setup = {
  name: string;
  nickname: string;
  vehicleId: string;
  vehicleUrl: string;
  pucId: string;
};

/** A vehicle with a policy (and its photo), an expired PUC (and its PDF) and road tax. */
async function vehicleWithPapers(page: Page, label: string): Promise<Setup> {
  const suffix = uniqueSuffix();
  const nickname = `${label} ${suffix.slice(-4)}`;
  const name = `E2E Papers ${suffix}`;

  await registerAndSignIn(page, {
    name,
    email: `e2e+papers${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  // The catalog pickers want room; the phone width comes after.
  await page.setViewportSize(DESKTOP);
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12SP${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  await prisma.insurancePolicy.create({
    data: {
      vehicleId: vehicle.id,
      provider: `Acme General ${suffix.slice(-4)}`,
      policyNumber: `OG-${suffix.slice(-6)}`,
      startDate: utcDay(-100),
      endDate: utcDay(265),
    },
  });
  const puc = await prisma.complianceDocument.create({
    data: {
      vehicleId: vehicle.id,
      kind: 'puc',
      provider: `PUC Centre ${suffix.slice(-4)}`,
      number: `PUC-${suffix.slice(-6)}`,
      startDate: utcDay(-183),
      endDate: utcDay(-3),
    },
  });
  await prisma.complianceDocument.create({
    data: {
      vehicleId: vehicle.id,
      kind: 'road_tax',
      provider: 'RTO Pune',
      number: `TAX-${suffix.slice(-6)}`,
      startDate: utcDay(-400),
      endDate: utcDay(3000),
    },
  });

  // Files go on the papers' cards, as an owner adds them.
  await page.goto(`${vehicleUrl}?tab=papers`);
  const addFiles = page.getByRole('region', { name: 'Document files' });
  const photo = await policyPhoto(page);
  // The innermost block holding both the paper's name and its files: its own card.
  const cardOf = (text: string) =>
    page
      .locator('div', { has: page.getByText(text) })
      .filter({ has: addFiles })
      .last();
  await cardOf(`Acme General ${suffix.slice(-4)}`)
    .getByLabel('Add files to this document')
    .setInputFiles(photo);
  await expect(page.getByRole('button', { name: /^policy\.jpg/ })).toBeVisible();
  await cardOf(`PUC Centre ${suffix.slice(-4)}`)
    .getByLabel('Add files to this document')
    .setInputFiles(receiptPdf);
  await expect(page.getByRole('button', { name: /^sample-receipt\.pdf/ })).toBeVisible();

  return { name, nickname, vehicleId: vehicle.id, vehicleUrl, pucId: puc.id };
}

test.describe('Show papers', () => {
  test('every paper in one view, two taps from Home, and still there offline', async ({
    page,
    context,
  }) => {
    const { nickname, vehicleId, vehicleUrl, pucId } = await vehicleWithPapers(page, 'Papers');
    await page.setViewportSize(PHONE);

    // Home, then the card's Show papers: one tap.
    await page.goto('/home');
    await page.getByRole('link', { name: `Show papers for ${nickname}` }).click();
    await expect(page).toHaveURL(/\/papers$/);

    const view = page.getByTestId('show-papers');
    await expect(view).toBeVisible();
    // Over the whole screen, the app's own navigation included, and nothing spills sideways.
    expect(await view.boundingBox()).toMatchObject({ x: 0, y: 0, ...PHONE });
    const tabs = view.getByRole('tab');
    await expect(tabs).toHaveText(['Insurance', 'PUC', 'Road tax']);
    await expect(view.getByRole('tab', { name: 'Insurance' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(view.getByRole('status')).toContainText('VALID');
    await expect(view.getByText(/^OG-\d{6}$/)).toBeVisible();
    await expect(view.getByRole('img', { name: 'policy.jpg' })).toBeVisible();
    // Once loaded, a copy is kept on the phone.
    await expect(view.getByText('Saved on this phone · works offline')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width,
    );
    await page.screenshot({ animations: 'disabled', path: 'test-results/show-papers-390.png' });

    await view.getByRole('tab', { name: 'PUC' }).click();
    await expect(page).toHaveURL(/paper=puc/);
    await expect(view.getByRole('status')).toContainText('EXPIRED');
    await expect(view.getByRole('button', { name: 'Open sample-receipt.pdf' })).toBeVisible();

    // Close goes back where it came from.
    await view.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/home$/);

    // From the vehicle header, one tap too.
    await page.goto(vehicleUrl);
    await page.getByRole('link', { name: 'Show papers' }).click();
    await expect(view.getByRole('tab', { name: 'Insurance' })).toBeVisible();

    // An old one-document link opens that paper's tab.
    await page.goto(`/vehicles/${vehicleId}/documents/puc/${pucId}`);
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}/papers\\?`));
    await expect(view.getByRole('tab', { name: 'PUC' })).toHaveAttribute('aria-selected', 'true');
    await expect(view.getByText(/^PUC-\d{6}$/)).toBeVisible();

    // No signal: the network goes after an online visit. The dev server has no
    // service worker to serve the app's code offline (the installed app does,
    // see the PWA test below), so this page loads Show papers' code online first.
    await page.goto('/home');
    await page.getByRole('link', { name: `Show papers for ${nickname}` }).click();
    await expect(view.getByText('Saved on this phone · works offline')).toBeVisible();
    await view.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await context.setOffline(true);
    await page.getByRole('link', { name: `Show papers for ${nickname}` }).click();

    await expect(view.getByText(/^Saved on this phone · updated \d+ \w{3} \d{4}, /)).toBeVisible();
    await expect(view.getByRole('tab')).toHaveText(['Insurance', 'PUC', 'Road tax']);
    await expect(view.getByText(/^OG-\d{6}$/)).toBeVisible();
    // The shrunk photo, from the phone's own storage.
    const photo = view.getByRole('img', { name: 'policy.jpg' });
    await expect(photo).toHaveAttribute('src', /^blob:/);
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(1600);
    await view.getByRole('tab', { name: 'Road tax' }).click();
    await expect(view.getByRole('status')).toContainText('VALID');
    await expect(view.getByText('RTO Pune')).toBeVisible();
    await page.screenshot({
      animations: 'disabled',
      path: 'test-results/show-papers-390-offline.png',
    });
    await context.setOffline(false);
  });

  test('opens with no signal from a cold start, as the installed app', async ({
    page,
    context,
  }) => {
    test.skip(
      !process.env.E2E_PWA,
      'needs the production build and its service worker, served by vite preview',
    );
    const { vehicleId } = await vehicleWithPapers(page, 'Cold');
    await page.setViewportSize(PHONE);

    await page.goto(`/vehicles/${vehicleId}/papers`);
    const view = page.getByTestId('show-papers');
    await expect(view.getByText('Saved on this phone · works offline')).toBeVisible();
    // The worker holds the app's code by the time it controls the page.
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);

    await context.setOffline(true);
    await page.reload();

    await expect(view.getByText(/^Saved on this phone · updated /)).toBeVisible();
    await expect(view.getByText(/^OG-\d{6}$/)).toBeVisible();
    const photo = view.getByRole('img', { name: 'policy.jpg' });
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(1600);
    await context.setOffline(false);
  });

  test('at desktop width, and the saved copies go with the session', async ({ page }) => {
    const { nickname, vehicleId, vehicleUrl } = await vehicleWithPapers(page, 'Desk');
    await page.setViewportSize(DESKTOP);

    await page.goto(vehicleUrl);
    await page.getByRole('link', { name: 'Show papers' }).click();
    const view = page.getByTestId('show-papers');
    await expect(view.getByRole('tab')).toHaveText(['Insurance', 'PUC', 'Road tax']);
    await expect(view.getByText('Saved on this phone · works offline')).toBeVisible();
    expect(await view.boundingBox()).toMatchObject({ x: 0, y: 0, ...DESKTOP });
    await page.screenshot({ animations: 'disabled', path: 'test-results/show-papers-1440.png' });
    expect(await savedVehicleIds(page)).toEqual([vehicleId]);

    // A vehicle the user no longer has: its copy goes the next time the garage loads.
    await view.getByRole('button', { name: 'Close' }).click();
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await page.goto('/garage');
    await expect(page.getByRole('link', { name: `Show papers for ${nickname}` })).toHaveCount(0);
    await expect.poll(() => savedVehicleIds(page)).toEqual([]);
  });

  test('signing out clears the saved papers', async ({ page }) => {
    const { name, vehicleId, vehicleUrl } = await vehicleWithPapers(page, 'Out');
    await page.goto(`${vehicleUrl}/papers`);
    await expect(page.getByText('Saved on this phone · works offline')).toBeVisible();
    expect(await savedVehicleIds(page)).toEqual([vehicleId]);

    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await expect.poll(() => savedVehicleIds(page)).toEqual([]);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
