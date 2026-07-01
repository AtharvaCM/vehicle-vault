/**
 * BikeWale motorcycle spec scraper.
 *
 * BikeWale doesn't expose per-variant spec URLs the way CarWale does. The
 * `/specifications/` page renders the spec block once per model, so we apply
 * the same parsed spec to every catalog variant in that model. Motorcycle
 * variants in the catalog typically differ by ABS channels, transmission, or
 * cosmetic trim — engine/dimensions/fuel-tank are uniform across trims.
 *
 * Usage:
 *   pnpm catalog:scrape-bike-specs                    # all motorcycle makes
 *   pnpm catalog:scrape-bike-specs -- --brand=bajaj
 *   pnpm catalog:scrape-bike-specs -- --dry-run
 *   pnpm catalog:scrape-bike-specs -- --force         # overwrite existing
 */
import puppeteer, { type Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// BikeWale spec data-itemid → ParsedSpec field. Each row renders as
// "<label><value>" inside a single span; we split on the label suffix when
// parsing. See `extractSpecs` for the heuristic.
const SPEC_LABELS: Record<string, { key: keyof ParsedSpec | string; label: string }> = {
  '376': { key: '_displacement', label: 'Displacement' },
  '377': { key: '_maxPower', label: 'Max Power' },
  '378': { key: '_maxTorque', label: 'Max Torque' },
  '394': { key: 'topSpeedKph', label: 'Top Speed' },
  '406': { key: '_mileageArai', label: 'Mileage - ARAI' },
  '671': { key: '_mileageOwner', label: 'Mileage - Owner Reported' },
  '650': { key: '_transmission', label: 'Transmission' },
  '407': { key: '_ridingRange', label: 'Riding Range' },
  '1805': { key: '_engineType', label: 'Engine Type' },
  // Frame / chassis / suspension
  '380': { key: 'frameType', label: 'Frame' },
  '381': { key: '_frontSuspension', label: 'Front Suspension' },
  '382': { key: '_rearSuspension', label: 'Rear Suspension' },
  '383': { key: 'brakeFrontType', label: 'Front Brake Type' },
  '384': { key: 'brakeRearType', label: 'Rear Brake Type' },
  // Dimensions
  '388': { key: 'lengthMm', label: 'Length' },
  '390': { key: 'widthMm', label: 'Width' },
  '391': { key: 'heightMm', label: 'Height' },
  '386': { key: 'wheelbaseMm', label: 'Wheelbase' },
  '392': { key: 'groundClearanceMm', label: 'Ground Clearance' },
  '393': { key: 'seatHeightMm', label: 'Seat Height' },
  '387': { key: 'kerbWeightKg', label: 'Kerb Weight' },
  '385': { key: 'fuelCapLitres', label: 'Fuel Capacity' },
  // Tyres
  '395': { key: '_frontTyre', label: 'Front Tyre' },
  '396': { key: '_rearTyre', label: 'Rear Tyre' },
  // Safety
  '397': { key: '_abs', label: 'ABS' },
};

type RawSpecData = Record<string, string>;

type ParsedSpec = {
  engineCc?: number;
  engineCyl?: number;
  engineType?: string;
  coolingType?: string;
  powerPs?: number;
  powerRpm?: number;
  torqueNm?: number;
  torqueRpm?: number;
  topSpeedKph?: number;
  mileageCombined?: number;
  transmission?: string;
  gearCount?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  wheelbaseMm?: number;
  groundClearanceMm?: number;
  seatHeightMm?: number;
  kerbWeightKg?: number;
  fuelCapLitres?: number;
  rangeKm?: number;
  frameType?: string;
  brakeFrontType?: string;
  brakeRearType?: string;
  tyreSize?: string;
  absChannels?: number;
};

const BRAND_SLUG_OVERRIDES: Record<string, string> = {
  'royal-enfield': 'royalenfield',
};

// `<brand>:<catalog model slug>` -> bikewale model slug. Use when the
// catalog name (sourced from OEM site) doesn't match BikeWale's URL slug.
const MODEL_SLUG_OVERRIDES: Record<string, string> = {
  'yamaha:fz-s-fi': 'fz-s',
  'yamaha:rayzr': 'ray-zr-125',
};

function bikewaleBrandSlug(catalogSlug: string): string {
  return BRAND_SLUG_OVERRIDES[catalogSlug] ?? catalogSlug;
}

function bikewaleModelSlug(makeSlug: string, modelSlug: string): string {
  return MODEL_SLUG_OVERRIDES[`${makeSlug}:${modelSlug}`] ?? modelSlug;
}

function specsUrl(makeSlug: string, modelSlug: string): string {
  // The model home page renders the full spec block via data-itemid rows.
  // Sibling routes like /specifications/ return 404 and /specifications-features/
  // is a client-rendered SPA that doesn't expose the data without interaction.
  return `https://www.bikewale.com/${bikewaleBrandSlug(makeSlug)}-bikes/${bikewaleModelSlug(makeSlug, modelSlug)}/`;
}

async function extractSpecs(page: Page, url: string): Promise<RawSpecData> {
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!resp || resp.status() >= 400) return {};
  } catch {
    return {};
  }

  await page.waitForSelector('[data-itemid]', { timeout: 8000 }).catch(() => null);

  return page.evaluate((labelMap) => {
    const out: Record<string, string> = {};
    document.querySelectorAll('[data-itemid]').forEach((el) => {
      const id = el.getAttribute('data-itemid') ?? '';
      const entry = labelMap[id];
      if (!entry) return;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      // Row text is "<Label><Value>" with no separator. Strip the label prefix.
      const labelLower = entry.label.toLowerCase();
      const textLower = text.toLowerCase();
      let value = text;
      if (textLower.startsWith(labelLower)) {
        value = text.slice(entry.label.length).trim();
      }
      if (value) out[entry.key] = value;
    });
    return out;
  }, SPEC_LABELS);
}

function num(re: RegExp, src?: string): number | undefined {
  if (!src) return undefined;
  const m = src.match(re);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parse(raw: RawSpecData): ParsedSpec {
  const s: ParsedSpec = {};

  s.engineCc = num(/([\d.]+)\s*cc/i, raw._displacement);
  if (raw._engineType) {
    const cyl = raw._engineType.match(/(\d+)\s*Cylinder/i);
    if (cyl) s.engineCyl = +cyl[1];
    const cool = raw._engineType.match(/(liquid|oil(?:\s*&\s*[a-z]+)?|air(?:\s*&\s*[a-z]+)?)[-\s]?cooled/i);
    if (cool) s.coolingType = `${cool[1].toLowerCase().replace(/\s+/g, ' ')}-cooled`;
    s.engineType = raw._engineType.trim();
  }

  if (raw._maxPower) {
    s.powerPs = num(/([\d.]+)\s*(?:bhp|ps|hp)/i, raw._maxPower);
    const r = raw._maxPower.match(/@\s*(\d+)/);
    if (r) s.powerRpm = +r[1];
  }
  if (raw._maxTorque) {
    s.torqueNm = num(/([\d.]+)\s*Nm/i, raw._maxTorque);
    const r = raw._maxTorque.match(/@\s*(\d+)/);
    if (r) s.torqueRpm = +r[1];
  }

  if (raw.topSpeedKph) s.topSpeedKph = num(/([\d.]+)/, raw.topSpeedKph);
  if (raw._mileageArai) s.mileageCombined = num(/([\d.]+)\s*km/i, raw._mileageArai);
  else if (raw._mileageOwner) s.mileageCombined = num(/([\d.]+)\s*km/i, raw._mileageOwner);
  if (raw._ridingRange) s.rangeKm = num(/([\d.]+)\s*km/i, raw._ridingRange);

  if (raw._transmission) {
    s.transmission = raw._transmission.trim();
    const g = raw._transmission.match(/(\d)\s*Speed/i);
    if (g) s.gearCount = +g[1];
  }

  if (raw.lengthMm) s.lengthMm = num(/(\d+)/, raw.lengthMm);
  if (raw.widthMm) s.widthMm = num(/(\d+)/, raw.widthMm);
  if (raw.heightMm) s.heightMm = num(/(\d+)/, raw.heightMm);
  if (raw.wheelbaseMm) s.wheelbaseMm = num(/(\d+)/, raw.wheelbaseMm);
  if (raw.groundClearanceMm) s.groundClearanceMm = num(/(\d+)/, raw.groundClearanceMm);
  if (raw.seatHeightMm) s.seatHeightMm = num(/(\d+)/, raw.seatHeightMm);
  if (raw.kerbWeightKg) s.kerbWeightKg = num(/([\d.]+)/, raw.kerbWeightKg);
  if (raw.fuelCapLitres) s.fuelCapLitres = num(/([\d.]+)/, raw.fuelCapLitres);

  if (raw.frameType) s.frameType = raw.frameType.trim();
  if (raw.brakeFrontType) s.brakeFrontType = raw.brakeFrontType.trim();
  if (raw.brakeRearType) s.brakeRearType = raw.brakeRearType.trim();
  if (raw._frontTyre) s.tyreSize = raw._frontTyre.trim();

  if (raw._abs) {
    const a = raw._abs.toLowerCase();
    if (a.includes('dual') || a.includes('2 channel') || a.includes('double')) s.absChannels = 2;
    else if (a.includes('single') || a.includes('1 channel')) s.absChannels = 1;
  }

  return s;
}

function hasData(spec: ParsedSpec): boolean {
  return Object.values(spec).some((v) => v !== undefined);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const brandArg = process.argv.find((a) => a.startsWith('--brand='));
  return {
    brand: brandArg?.split('=')[1],
    dryRun: process.argv.includes('--dry-run'),
    force: process.argv.includes('--force'),
  };
}

async function main() {
  const args = parseArgs();

  console.log('🏍  BikeWale Spec Scraper');
  console.log('========================================');

  const makes = await prisma.vehicleCatalogMake.findMany({
    where: {
      vehicleType: 'motorcycle',
      ...(args.brand
        ? {
            OR: [
              { slug: args.brand },
              { name: { equals: args.brand, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      models: {
        include: {
          generations: { include: { variants: { include: { spec: true } } } },
        },
      },
    },
  });

  console.log(`📂 ${makes.length} motorcycle make(s) to process\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  let totalModels = 0;
  let totalUpserted = 0;
  let totalFailed = 0;

  for (const make of makes) {
    console.log(`🏭 ${make.name} (${make.slug} → ${bikewaleBrandSlug(make.slug)})`);
    for (const model of make.models) {
      totalModels++;
      const variants = model.generations.flatMap((g) => g.variants);
      if (variants.length === 0) continue;

      const url = specsUrl(make.slug, model.slug);
      console.log(`   🏍  ${model.name}  (${variants.length} variants)`);

      const raw = await extractSpecs(page, url);
      if (Object.keys(raw).length === 0) {
        console.log(`      ⚠️  No spec data at ${url}`);
        totalFailed++;
        await sleep(400);
        continue;
      }
      const parsed = parse(raw);
      if (!hasData(parsed)) {
        console.log(`      ⚠️  Parsed spec empty (${Object.keys(raw).length} raw keys)`);
        totalFailed++;
        await sleep(400);
        continue;
      }

      for (const v of variants) {
        if (v.spec && !args.force) continue;
        if (args.dryRun) {
          console.log(`      📋 [DRY] ${v.name}: ${JSON.stringify(parsed).slice(0, 100)}…`);
        } else {
          await prisma.vehicleCatalogVariantSpec.upsert({
            where: { variantId: v.id },
            update: { ...parsed, sourceName: 'bikewale-puppeteer' },
            create: { variantId: v.id, ...parsed, sourceName: 'bikewale-puppeteer' },
          });
          console.log(`      ✅ Upserted ${v.name}`);
        }
        totalUpserted++;
      }

      await sleep(800);
    }
  }

  try { await page.close(); } catch {}
  try { await browser.close(); } catch {}
  await prisma.$disconnect();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✨ Summary`);
  console.log(`   Models processed: ${totalModels}`);
  console.log(`   Specs upserted:   ${totalUpserted}`);
  console.log(`   Failed models:    ${totalFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
