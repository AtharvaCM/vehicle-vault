import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

type Target = { path: string; variantId: string };
const restore: Array<() => Promise<unknown>> = [];

/** A seeded two-wheeler variant with a public page, found by model slug. */
async function variantOf(modelSlug: string): Promise<Target> {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: {} },
      generation: { model: { slug: modelSlug, make: { vehicleType: 'motorcycle' } } },
    },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  return {
    variantId: variant.id,
    path: `/bikes/${generation.model.make.slug}/${generation.model.slug}/${generation.slug}/${variant.slug}`,
  };
}

/** Sets a variant's drive and cooling for this file, putting back what was there. */
async function setSpec(
  variantId: string,
  data: { driveType: string | null; coolingType: string | null },
) {
  const before = await prisma.vehicleCatalogVariantSpec.findUnique({ where: { variantId } });
  if (before) {
    await prisma.vehicleCatalogVariantSpec.update({ where: { variantId }, data });
    restore.push(() =>
      prisma.vehicleCatalogVariantSpec.update({
        where: { variantId },
        data: { driveType: before.driveType, coolingType: before.coolingType },
      }),
    );
  } else {
    await prisma.vehicleCatalogVariantSpec.create({ data: { variantId, ...data } });
    restore.push(() => prisma.vehicleCatalogVariantSpec.delete({ where: { variantId } }));
  }
}

let classic: Target;
let jupiter: Target;
let apache: Target;

test.beforeAll(async () => {
  classic = await variantOf('classic-350');
  jupiter = await variantOf('jupiter');
  apache = await variantOf('apache-rtr-160');
  await setSpec(classic.variantId, { driveType: 'chain', coolingType: 'air-cooled' });
  await setSpec(jupiter.variantId, { driveType: 'belt', coolingType: 'air-cooled' });
  await setSpec(apache.variantId, { driveType: 'chain', coolingType: 'liquid-cooled' });
});

async function scheduleOf(page: Page, path: string) {
  await page.goto(path);
  const schedule = page.getByRole('region', { name: /schedule/i });
  await expect(schedule.getByRole('listitem').first()).toBeVisible();
  return schedule;
}

/**
 * #235: a two-wheeler's schedule follows its recorded final drive and
 * cooling: chain service for a chain-driven Royal Enfield Classic 350, none
 * for a TVS Jupiter's belt; coolant only for a liquid-cooled engine.
 */
for (const viewport of VIEWPORTS) {
  test(`two-wheeler schedules follow drive and cooling, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    const classicSchedule = await scheduleOf(page, classic.path);
    await expect(classicSchedule.getByText('Chain service', { exact: true })).toBeVisible();
    await expect(classicSchedule.getByText('Coolant', { exact: true })).toHaveCount(0);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/bike-classic-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    const jupiterSchedule = await scheduleOf(page, jupiter.path);
    await expect(jupiterSchedule.getByText('Chain service', { exact: true })).toHaveCount(0);

    const apacheSchedule = await scheduleOf(page, apache.path);
    await expect(apacheSchedule.getByText('Coolant', { exact: true })).toBeVisible();
  });
}

test.afterAll(async () => {
  for (const undo of restore.reverse()) await undo();
  await prisma.$disconnect();
});
