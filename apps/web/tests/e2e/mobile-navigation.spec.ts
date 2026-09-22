import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 1024, height: 768 };
const DESKTOP = { width: 1280, height: 800 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function signIn(page: Page, label: string) {
  const suffix = uniqueSuffix();
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+${label.toLowerCase()}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  return suffix;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** Seeds through the API as the signed-in user: far quicker than the forms. */
async function post(page: Page, path: string, data: object) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api/${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `POST ${path}: ${await response.text()}`).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

/**
 * Fails, softly, when the page is wider than the screen — naming the outermost
 * elements that stick out, so a failure points at a component rather than
 * only reporting a width.
 */
async function expectNoSidewaysScroll(page: Page, where: string) {
  const screen = page.viewportSize()!.width;
  const { width, culprits } = await page.evaluate(() => {
    const edge = document.documentElement.clientWidth;
    const width = document.documentElement.scrollWidth;
    if (width <= edge) return { width, culprits: [] as string[] };

    const sticksOut = (node: Element | null) =>
      node !== null && node.getBoundingClientRect().right > edge + 1;
    // Past the edge inside a scroller, like the tab strip, or a clipping card is fine.
    const clipped = (node: Element) => {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX !== 'visible') return true;
      }
      return false;
    };
    const culprits = Array.from(document.querySelectorAll('body *'))
      .filter((node) => sticksOut(node) && !sticksOut(node.parentElement) && !clipped(node))
      .slice(0, 3)
      .map(
        (node) =>
          `<${node.tagName.toLowerCase()} class="${node.getAttribute('class') ?? ''}"> "${(node.textContent ?? '').trim().slice(0, 40)}"`,
      );
    return { width, culprits };
  });

  expect
    .soft(width, `${where} is ${width}px wide on a ${screen}px screen. ${culprits.join(' ')}`)
    .toBeLessThanOrEqual(screen);
}

/**
 * A page can stop scrolling sideways by squeezing a card instead: a title
 * crushed to one letter, or figures pushed out of view. The card named by
 * `title` has to leave its title a readable width, even if an ellipsis cuts it
 * short, and keep each figure inside the card.
 */
async function expectReadableCard(page: Page, title: string, figures: string[]) {
  const card = page.getByRole('main').getByRole('link', { name: title }).first();
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;

  const titleWidth = Math.round(
    (await card.getByText(title, { exact: true }).boundingBox())!.width,
  );
  expect
    .soft(titleWidth, `The card for "${title}" leaves its title ${titleWidth}px wide.`)
    .toBeGreaterThanOrEqual(160);

  for (const figure of figures) {
    const box = (await card.getByText(figure, { exact: true }).boundingBox())!;
    expect
      .soft(
        box.x >= cardBox.x && box.x + box.width <= cardBox.x + cardBox.width,
        `The card for "${title}" pushes ${figure} out of view.`,
      )
      .toBe(true);
  }
}

/**
 * The shell was a desktop layout squeezed onto a phone. Below md the primary
 * navigation moves to a bottom bar; from md up nothing changes. jsdom cannot
 * evaluate a breakpoint, so the widths are checked here, in a real browser.
 */
test('a phone gets the bottom bar instead of the menu button', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, 'Phone');

  const bar = page.getByRole('navigation', { name: 'Primary' });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();

  // The page leaves room for the bar, so it never covers the last row.
  const room = await page.evaluate(() => {
    const main = document.getElementById('main-content');
    const nav = document.querySelector('[data-testid="bottom-nav"]');
    return {
      padding: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0,
      bar: nav ? nav.getBoundingClientRect().height : Infinity,
    };
  });
  expect(room.padding).toBeGreaterThanOrEqual(room.bar);

  await bar.getByRole('link', { name: 'Vehicles' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);
  // Where you are reads at a glance: the current destination is coloured apart.
  const vehicles = bar.getByRole('link', { name: 'Vehicles' });
  await expect(vehicles).toHaveAttribute('data-status', 'active');
  const colourOf = (name: string) =>
    bar.getByRole('link', { name }).evaluate((node) => getComputedStyle(node).color);
  expect(await colourOf('Vehicles')).not.toBe(await colourOf('Dashboard'));

  // Everything that does not fit on the bar is one tap away.
  await bar.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: /loans/i })).toBeVisible();
});

test('from md up the layout is unchanged', async ({ page }) => {
  await page.setViewportSize(TABLET);
  await signIn(page, 'Tablet');

  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
});

test('the vehicle tabs scroll on a phone, with a linked tab brought into view', async ({
  page,
}) => {
  const suffix = await signIn(page, 'Tabs');
  await createCatalogVehicle(page, {
    nickname: `Tabs Garage ${suffix.slice(-4)}`,
    odometer: '15200',
    registrationNumber: `MH12TB${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();

  await page.setViewportSize(PHONE);
  // Activity is the last of the tabs: far off the right edge of a phone.
  await page.goto(`${vehicleUrl}?tab=activity`);

  const activity = page.getByRole('tab', { name: 'Activity' });
  await expect(activity).toHaveAttribute('data-state', 'active');
  const box = await activity.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);

  // The strip scrolls rather than clipping or pushing the page sideways.
  const strip = page.getByRole('tablist');
  expect(await strip.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await expect(page.getByRole('tabpanel').getByText('Vehicle created')).toBeVisible();
  await expectNoSidewaysScroll(page, 'The activity tab');
});

/**
 * Long, unbroken content is what pushes a phone sideways: a workshop's full
 * name, an email address, a JSON diff. Every vehicle tab, the top-level pages
 * and the lists the tabs link to are walked with some of it on screen, each
 * measured once its content has loaded — any earlier, a page is only as wide
 * as its loading state. The pages that lay out differently on wider screens are
 * measured there too.
 */
test('no tab or page scrolls sideways, on a phone or wider', async ({ page }) => {
  test.slow();
  const suffix = await signIn(page, 'Overflow');
  const nickname = `Overflow Garage ${suffix.slice(-4)}`;
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber: `MH12OV${suffix.slice(-4)}`,
  });
  const vehicleId = vehicleUrl.split('/').pop()!;

  const workshop = 'Sai Service Hyundai Authorised Workshop, Baner Road';
  const reminderTitle = 'Periodic service and brake fluid replacement';
  const lender = 'HDFC Bank Vehicle Finance';
  const invitee = `invitee.with.a.long.address.${suffix}@vehiclevault.dev`;
  await post(page, `vehicles/${vehicleId}/maintenance-records`, {
    category: 'periodic_service',
    serviceDate: daysFromNow(-40),
    odometer: 14800,
    workshopName: workshop,
    invoiceNumber: 'INV-2026-000184-BNR',
    totalCost: 8450,
    lineItems: [{ kind: 'part', name: 'Engine oil 5W-30 fully synthetic', lineTotal: 3200 }],
  });
  const reminder = await post(page, `vehicles/${vehicleId}/reminders`, {
    title: reminderTitle,
    type: 'service',
    dueDate: daysFromNow(20),
    dueOdometer: 24800,
  });
  await post(page, `vehicle-loans/vehicle/${vehicleId}`, {
    lender,
    principal: 1150000,
    interestRate: 8.75,
    tenureMonths: 60,
    startDate: daysFromNow(-400),
  });
  await post(page, `vehicles/${vehicleId}/invites`, { email: invitee, role: 'viewer' });

  await page.setViewportSize(PHONE);

  // Each tab, with what it shows only once its data has loaded.
  const tabs: Array<[string, Array<string | RegExp>]> = [
    ['overview', [workshop, reminderTitle]],
    ['maintenance', [workshop]],
    ['specs', [/No specifications available|Engine & Drivetrain/]],
    ['reminders', [reminderTitle]],
    ['fuel', ['No fuel logs found']],
    ['tyres', ['Log inspection']],
    ['accessories', ['No accessories yet']],
    ['protection', ['Add Policy']],
    ['loans', [lender]],
    ['members', [invitee]],
    ['activity', ['Reminder created']],
  ];
  for (const [tab, loaded] of tabs) {
    await page.goto(`${vehicleUrl}?tab=${tab}`);
    for (const text of loaded) {
      await expect(page.getByRole('tabpanel').getByText(text).first()).toBeVisible();
    }
    await expectNoSidewaysScroll(page, `The ${tab} tab`);
  }

  // Opened, an activity entry lists every changed value: ids and JSON with
  // nowhere to wrap.
  const closed = page.getByRole('tabpanel').locator('button[aria-expanded="false"]');
  for (let remaining = await closed.count(); remaining > 0; remaining -= 1) {
    await closed.first().click();
  }
  await expect(closed).toHaveCount(0);
  await expectNoSidewaysScroll(page, 'The activity tab, every entry open');

  const pages: Array<[string, string]> = [
    ['/dashboard', workshop],
    ['/vehicles', nickname],
    ['/maintenance', workshop],
    ['/reminders', reminderTitle],
    ['/loans', lender],
    ['/settings', 'Download JSON backup'],
    ['/settings/activity', 'Reminder created'],
    [`/vehicles/${vehicleId}/maintenance`, workshop],
    [`/vehicles/${vehicleId}/reminders`, reminderTitle],
    [`/reminders/${reminder.id}`, 'Mark Complete'],
  ];
  for (const [path, loaded] of pages) {
    await page.goto(path);
    await expect(page.getByRole('main').getByText(loaded).first()).toBeVisible();
    await expectNoSidewaysScroll(page, path);
  }

  // From xl the sidebar opens and these panels split into two columns, which
  // leaves a record or reminder card narrower at 1280px than on a tablet.
  const recordCard: [string, string[]] = [workshop, ['14,800 km', '₹8,450']];
  const reminderCard: [string, string[]] = [reminderTitle, ['24,800 km']];
  const desktopPages: Array<[string, string, Array<[string, string[]]>]> = [
    ['The overview tab', `${vehicleUrl}?tab=overview`, [recordCard, reminderCard]],
    ['The maintenance tab', `${vehicleUrl}?tab=maintenance`, [recordCard]],
    [`/vehicles/${vehicleId}/maintenance`, `/vehicles/${vehicleId}/maintenance`, [recordCard]],
  ];
  await page.setViewportSize(DESKTOP);
  for (const [where, path, cards] of desktopPages) {
    await page.goto(path);
    for (const [title, figures] of cards) {
      await expectReadableCard(page, title, figures);
    }
    await expectNoSidewaysScroll(page, where);
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
