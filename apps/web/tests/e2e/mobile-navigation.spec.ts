import { expect, test, type Locator, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 1024, height: 768 };
const PORTRAIT_TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };
const WIDE_DESKTOP = { width: 1440, height: 900 };

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
 * crushed to one letter, or figures pushed out of view. The card has to leave
 * its title a readable width, even if an ellipsis cuts it short, and keep each
 * figure inside the card.
 */
async function expectReadableCard(card: Locator, title: string, figures: string[]) {
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;

  // Measured on the title's row, which spans the card's text: a long title fills
  // it, but a short one, like a fill's, is only as wide as its words, and wraps
  // them one to a line when the row is too narrow.
  const titleWidth = Math.round(
    await card
      .getByText(title, { exact: true })
      .evaluate((node) => node.parentElement!.getBoundingClientRect().width),
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
 * A card can spill a button past its own edge without widening the page, as the
 * dashboard's garage card did three across at 1280px. Every link and button in
 * `card` has to sit inside it.
 */
async function expectControlsInsideCard(card: Locator, where: string) {
  const cardBox = (await card.boundingBox())!;
  for (const control of await card.locator('a, button').all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    const name = (await control.getAttribute('aria-label')) ?? (await control.innerText());
    expect
      .soft(
        box.x >= cardBox.x && box.x + box.width <= cardBox.x + cardBox.width,
        `${where}: "${name}" sticks out of the card.`,
      )
      .toBe(true);
  }
}

/**
 * An icon beside text that wraps is a flex item like any other, and shrinks
 * unless told not to: the fuel card's pin fell to 4px and the suggested
 * schedule's sparkles to 11px on a phone. Every icon on the page is square, so
 * one that is narrower than it is tall has been squeezed.
 */
async function expectNoSqueezedIcons(page: Page, where: string) {
  const squeezed = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main svg.lucide'))
      .map((icon) => ({ icon, box: icon.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && Math.abs(box.width - box.height) > 0.5)
      .map(({ icon, box }) => {
        const name = Array.from(icon.classList).find((c) => c.startsWith('lucide-'));
        const beside = (icon.parentElement?.textContent ?? '').trim().slice(0, 40);
        return `${name} ${box.width.toFixed(1)}x${box.height.toFixed(1)} beside "${beside}"`;
      }),
  );
  expect.soft(squeezed, `${where} squeezes an icon.`).toEqual([]);
}

/**
 * A fill's three figures and its menu share one strip, which a phone leaves
 * narrow. No label or figure may break over two lines, as "15,180 km" and
 * "Total Cost" did at 375px: when the three do not fit, a whole figure moves to
 * a second row. And a long location wraps beside its pin without squeezing it.
 */
async function expectFillFitsPhone(card: Locator, title: string, figures: string[]) {
  for (const text of ['Odometer', 'Price/L', 'Total Cost', ...figures]) {
    const lines = await card
      .getByText(text, { exact: true })
      .evaluate((node) =>
        Math.round(
          node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight),
        ),
      );
    expect.soft(lines, `The card for "${title}" breaks "${text}" over ${lines} lines.`).toBe(1);
  }
  const pin = card.locator('svg.lucide-map-pin');
  if (await pin.count()) {
    const width = Math.round((await pin.boundingBox())!.width);
    expect.soft(width, `The card for "${title}" squeezes its location pin to ${width}px.`).toBe(12);
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
  await post(page, `fuel-logs/vehicle/${vehicleId}`, {
    date: daysFromNow(-30),
    odometer: 14950,
    quantity: 30,
    price: 105,
    totalCost: 3150,
  });
  await post(page, `fuel-logs/vehicle/${vehicleId}`, {
    date: daysFromNow(-10),
    odometer: 15180,
    quantity: 42.5,
    price: 106,
    totalCost: 4505,
    location: 'Indian Oil, Baner Road',
  });
  await post(page, `fuel-logs/vehicle/${vehicleId}`, {
    date: daysFromNow(-3),
    odometer: 15410,
    quantity: 25,
    price: 104,
    totalCost: 2600,
    location: 'Hindustan Petroleum COCO outlet, Mumbai–Pune Expressway, Lonavala',
  });
  const fills: Array<[string, string[]]> = [
    ['30 L Fuel Fill', ['14,950 km', '₹105', '₹3,150']],
    ['42.5 L Fuel Fill', ['15,180 km', '₹106', '₹4,505']],
    ['25 L Fuel Fill', ['15,410 km', '₹104', '₹2,600']],
  ];

  await page.setViewportSize(PHONE);

  // Each tab, with what it shows only once its data has loaded.
  const tabs: Array<[string, Array<string | RegExp>]> = [
    ['overview', [workshop, reminderTitle]],
    ['maintenance', [workshop]],
    ['specs', [/No specifications available|Engine & Drivetrain/]],
    ['reminders', [reminderTitle]],
    ['fuel', ['42.5 L Fuel Fill']],
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
    await expectNoSqueezedIcons(page, `The ${tab} tab`);
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
    await expectNoSqueezedIcons(page, path);
  }

  // On a phone a fill's three figures and menu share one narrow strip.
  await page.goto(`${vehicleUrl}?tab=fuel`);
  for (const [title, figures] of fills) {
    const card = page
      .getByRole('main')
      .locator('[data-slot="card"]', { has: page.getByText(title, { exact: true }) });
    await expect(card).toBeVisible();
    await expectFillFitsPhone(card, title, figures);
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
      const card = page.getByRole('main').getByRole('link', { name: title }).first();
      await expectReadableCard(card, title, figures);
    }
    await expectNoSidewaysScroll(page, where);
  }

  // The fuel tab splits the same way, and a fill's three figures and menu need
  // more room beside its text than a record's two figures. So it is measured at
  // 1440px too, where its cards are wide enough for a record's figures to sit
  // beside the text, but not for a fill's.
  for (const screen of [DESKTOP, WIDE_DESKTOP]) {
    await page.setViewportSize(screen);
    await page.goto(`${vehicleUrl}?tab=fuel`);
    for (const [title, figures] of fills) {
      // A fill's card is not a link.
      const card = page
        .getByRole('main')
        .locator('[data-slot="card"]', { has: page.getByText(title, { exact: true }) });
      await expectReadableCard(card, title, figures);
    }
    await expectNoSidewaysScroll(page, `The fuel tab at ${screen.width}px`);
  }

  // From sm the page header puts its actions beside the title, and at 768px a
  // long title and four actions do not fit on one row.
  await page.setViewportSize(PORTRAIT_TABLET);
  await page.goto(`/reminders/${reminder.id}`);
  await expect(page.getByRole('main').getByText('Mark Complete').first()).toBeVisible();
  await expectNoSidewaysScroll(page, `/reminders/${reminder.id}`);

  // The dashboard's garage cards are narrowest where the grid adds a column: two
  // across from sm, three beside the sidebar from xl. There a card must keep its
  // footer's buttons inside it, without dropping their labels to make room.
  const garageCard = page.getByTestId('vehicle-health-card').filter({ hasText: nickname });
  for (const width of [640, DESKTOP.width]) {
    await page.setViewportSize({ width, height: DESKTOP.height });
    await page.goto('/dashboard');
    await expect(garageCard.getByText('Log service', { exact: true })).toBeVisible();
    await expectControlsInsideCard(garageCard, `The garage card at ${width}px`);
    await expectNoSidewaysScroll(page, `/dashboard at ${width}px`);
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
