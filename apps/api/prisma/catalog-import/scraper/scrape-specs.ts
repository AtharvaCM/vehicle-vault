/**
 * Puppeteer-based spec scraper for CarWale.
 *
 * Strategy:
 * 1. Navigate to the model page (e.g. /volkswagen-cars/virtus/)
 * 2. Extract all exact variant URLs from the page
 * 3. Match those with variants in our database
 * 4. Visit each matching variant URL to extract specs using data-itemid
 *
 * Usage:
 *   pnpm catalog:scrape-specs -- --brand=volkswagen
 *   pnpm catalog:scrape-specs                          # All brands
 *   pnpm catalog:scrape-specs -- --brand=volkswagen --dry-run
 *   pnpm catalog:scrape-specs -- --brand=volkswagen --force  # Overwrite existing
 */
import puppeteer, { type Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CarWale data-itemid → our internal field mapping.
// Add itemids for new nuance fields here as they are discovered on CarWale spec
// pages (inspect element on a variant page → data-itemid attribute on the row).
const SPEC_ITEM_MAP: Record<string, string> = {
  '1706': '_mileage',
  '484': '_engine',
  '249': '_maxPower',
  '250': '_maxTorque',
  '1646': '_fuelType',
  '500': '_transmission',
  '501': '_drivetrain',
  '1645': '_dimensions',
  '525': '_wheelbase',
  '1591': '_kerbWeight',
  '1589': '_seatingCapacity',
  '524': '_groundClearance',
  '485': '_fuelTank',
  '1590': '_doors',
  '1647': '_turningRadius',
  '529': '_bootSpace',
  '515': '_frontTyres',
  '516': '_rearTyres',
  '1648': '_wheelType',
  '643': '_airbags',
  '703': '_ncapRating',
  // Free-text matchers below cover the rest (NCAP / EV / motorcycle / commercial).
};

// Regex-driven fallback. CarWale (and most sources) render a label + value block;
// we scrape the whole "specifications" section into a single blob and pattern-match.
// Keyed by ParsedSpec field, value is a list of regexes; first match wins.
const TEXT_PATTERNS: Array<{ field: keyof ParsedSpec; pattern: RegExp; transform?: (m: RegExpMatchArray) => unknown }> = [
  // Safety — NCAP
  { field: 'ncapStarsAdult', pattern: /(\d)\s*star[^.\n]*adult/i, transform: (m) => +m[1] },
  { field: 'ncapStarsChild', pattern: /(\d)\s*star[^.\n]*child/i, transform: (m) => +m[1] },
  { field: 'ncapRegion', pattern: /(global\s*ncap|bharat\s*ncap|euro\s*ncap|asean\s*ncap)/i, transform: (m) => m[1].replace(/\s+/g, ' ').toLowerCase() },
  { field: 'isofixPoints', pattern: /isofix[^0-9]{0,30}(\d+)/i, transform: (m) => +m[1] },
  // Boolean safety flags intentionally not regex-matched: full-page text on
  // CarWale variant pages includes comparison/related blocks, which yields
  // false positives. Populate from per-variant feature lists once a stable
  // selector is identified.
  // EV / Hybrid
  { field: 'batteryKwh', pattern: /([\d.]+)\s*kwh/i, transform: (m) => +m[1] },
  { field: 'rangeKm', pattern: /(?:range|certified range|claimed range)[^0-9]{0,30}(\d{2,4})\s*km/i, transform: (m) => +m[1] },
  { field: 'motorKw', pattern: /motor[^0-9]{0,30}([\d.]+)\s*kw/i, transform: (m) => +m[1] },
  { field: 'dcFastChargeKw', pattern: /(?:dc\s*fast|fast\s*charg)[^0-9]{0,30}([\d.]+)\s*kw/i, transform: (m) => +m[1] },
  { field: 'acChargeKw', pattern: /(?:ac\s*charg|onboard\s*charg)[^0-9]{0,30}([\d.]+)\s*kw/i, transform: (m) => +m[1] },
  { field: 'chargeTime0To80Min', pattern: /0\s*-\s*80%[^0-9]{0,20}(\d{1,3})\s*min/i, transform: (m) => +m[1] },
  { field: 'batteryChemistry', pattern: /\b(lfp|nmc|ncm|lithium[-\s]?ion|li[-\s]?ion)\b/i, transform: (m) => m[1].toLowerCase() },
  // Motorcycle
  { field: 'gearCount', pattern: /(\d)\s*[-\s]?speed|gearbox[^0-9]{0,20}(\d)/i, transform: (m) => +(m[1] || m[2]) },
  { field: 'coolingType', pattern: /(liquid|oil|air)\s*[-\s]?cooled/i, transform: (m) => `${m[1].toLowerCase()}-cooled` },
  { field: 'seatHeightMm', pattern: /seat\s*height[^0-9]{0,20}(\d{3,4})\s*mm/i, transform: (m) => +m[1] },
  { field: 'absChannels', pattern: /(single|dual|2[-\s]?channel)\s*abs/i, transform: (m) => (/dual|2/i.test(m[1]) ? 2 : 1) },
  // Commercial
  { field: 'payloadKg', pattern: /payload[^0-9]{0,20}([\d,]+)\s*kg/i, transform: (m) => +m[1].replace(/,/g, '') },
  { field: 'gvwKg', pattern: /(?:gvw|gross vehicle weight)[^0-9]{0,20}([\d,]+)\s*kg/i, transform: (m) => +m[1].replace(/,/g, '') },
  { field: 'towingCapacityKg', pattern: /towing[^0-9]{0,20}([\d,]+)\s*kg/i, transform: (m) => +m[1].replace(/,/g, '') },
  { field: 'cargoVolumeL', pattern: /cargo\s*(?:vol|capacity)[^0-9]{0,20}([\d,]+)\s*(?:l|litres)/i, transform: (m) => +m[1].replace(/,/g, '') },
];

type RawSpecData = Record<string, string>;

type ParsedSpec = {
  engineCc?: number;
  engineCyl?: number;
  engineType?: string;
  engineFuel?: string;
  powerPs?: number;
  powerRpm?: number;
  torqueNm?: number;
  torqueRpm?: number;
  transmission?: string;
  driveType?: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  wheelbaseMm?: number;
  kerbWeightKg?: number;
  bootSpaceLitres?: number;
  groundClearanceMm?: number;
  turningRadiusM?: number;
  mileageCombined?: number;
  fuelCapLitres?: number;
  seatingCapacity?: number;
  doors?: number;
  tyreSize?: string;
  wheelType?: string;
  airbagCount?: number;
  // Safety nuance
  ncapStarsAdult?: number;
  ncapStarsChild?: number;
  ncapRegion?: string;
  hasAbs?: boolean;
  hasEsc?: boolean;
  hasTpms?: boolean;
  hasHillHoldAssist?: boolean;
  isofixPoints?: number;
  adasFeatures?: string;
  // EV / Hybrid
  batteryKwh?: number;
  rangeKm?: number;
  motorKw?: number;
  acChargeKw?: number;
  dcFastChargeKw?: number;
  chargeTime0To80Min?: number;
  batteryChemistry?: string;
  // Motorcycle
  gearCount?: number;
  coolingType?: string;
  frameType?: string;
  seatHeightMm?: number;
  brakeFrontType?: string;
  brakeRearType?: string;
  absChannels?: number;
  // Commercial
  payloadKg?: number;
  gvwKg?: number;
  cargoVolumeL?: number;
  towingCapacityKg?: number;
  axleConfig?: string;
};

// ─── Scrape a single spec page ──────────────────────────────────────────────

async function scrapeVariantSpecs(page: Page, url: string): Promise<RawSpecData> {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!response || response.status() >= 400) return {};
  } catch {
    return {};
  }

  // Wait for spec elements to render
  await page.waitForSelector('div[data-itemid]', { timeout: 8000 }).catch(() => null);

  return page.evaluate((itemMap) => {
    const specs: Record<string, string> = {};

    for (const [id, field] of Object.entries(itemMap)) {
      const el = document.querySelector(`div[data-itemid="${id}"]`);
      if (!el) continue;

      // Primary: span.o-b has the formatted value
      const valueEl = el.querySelector('span.o-b');
      if (valueEl?.textContent?.trim()) {
        specs[field] = valueEl.textContent.trim();
        continue;
      }

      // List items (e.g. airbag breakdown)
      const lis = el.querySelectorAll('ul li');
      if (lis.length > 0) {
        specs[field] = Array.from(lis)
          .map((li) => li.textContent?.trim())
          .filter(Boolean)
          .join(', ');
        continue;
      }

      // Fallback: text after the label paragraph
      const fullText = el.textContent?.trim() || '';
      const label = el.querySelector('p')?.textContent?.trim() || '';
      const rest = fullText.replace(label, '').trim();
      if (rest) specs[field] = rest;
    }

    // Capture full page text for regex fallback matching of nuance fields
    // (NCAP, EV, motorcycle, commercial). CarWale renders these inline in the
    // main content area; selectors targeting narrow "specification" sections
    // miss them. Take the longest of a few candidates.
    const candidates: string[] = [];
    for (const sel of ['main', '#main', 'body']) {
      const node = document.querySelector(sel);
      const text = node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (text) candidates.push(text);
    }
    if (candidates.length > 0) {
      specs._fullText = candidates.reduce((a, b) => (b.length > a.length ? b : a));
    }

    return specs;
  }, SPEC_ITEM_MAP);
}

// ─── Extract variants from model page ───────────────────────────────────────

async function extractVariantUrls(
  page: Page,
  modelUrl: string,
): Promise<{ name: string; url: string }[]> {
  try {
    const response = await page.goto(modelUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!response || response.status() >= 400) return [];
  } catch {
    return [];
  }

  const modelPath = new URL(modelUrl).pathname;

  return page.evaluate((pathPrefix) => {
    const variants: { name: string; url: string }[] = [];
    const seenUrls = new Set<string>();

    const linkRegex = new RegExp('^' + pathPrefix + '([a-z0-9-]+)/?$');

    document.querySelectorAll('a[href]').forEach((el) => {
      const href = el.getAttribute('href')!;
      if (!href || href.startsWith('javascript:')) return;

      try {
        const fullUrl = href.startsWith('http')
          ? href
          : `https://www.carwale.com${href.startsWith('/') ? href : '/' + href}`;
        const pathname = new URL(fullUrl, 'https://www.carwale.com').pathname;

        if (linkRegex.test(pathname) && !seenUrls.has(fullUrl)) {
          const slug = pathname.split('/').filter(Boolean).pop() || '';
          // Exact-slug junk that lives under /<make>-cars/<model>/<slug>/.
          const EXACT_JUNK = new Set([
            'images',
            'videos',
            'compare',
            'colours',
            'mileage',
            'specifications',
            'features',
            'emi-calculator',
            '360-view',
            'reviews',
            'expert-reviews',
            'user-reviews',
            'news',
            'photos',
            'service-cost',
            'service-centres',
            'on-road-price',
            'road-test',
            'similar-cars',
            'used-cars',
            'comparison',
          ]);
          // Prefix-based junk (city-specific pages and aggregator slugs).
          const isJunkPrefix =
            slug.startsWith('price-in-') ||
            slug.startsWith('on-road-price-in-') ||
            slug.startsWith('emi-in-') ||
            slug.startsWith('user-reviews-') ||
            slug.startsWith('expert-reviews-') ||
            slug.startsWith('compare-with-') ||
            slug.startsWith('similar-to-') ||
            slug.includes('-vs-');
          if (EXACT_JUNK.has(slug) || isJunkPrefix) return;

          const rawText = el.textContent?.trim() || '';
          const name = rawText.replace(/^.*?(?:\r?\n|\s{2,})/, '').trim();
          if (name && name.length > 1 && !name.includes('Rs.')) {
            seenUrls.add(fullUrl);
            variants.push({ name, url: fullUrl });
          }
        }
      } catch (e) {
        // Ignore invalid URLs gracefully
      }
    });
    return variants;
  }, modelPath);
}

// ─── Parse raw text → typed fields ──────────────────────────────────────────

function parseRawSpecs(raw: RawSpecData): ParsedSpec {
  const s: ParsedSpec = {};

  // Engine: "1498 cc, 4 Cylinders Inline, 4 Valves/Cylinder, DOHC"
  if (raw._engine) {
    const cc = raw._engine.match(/(\d+)\s*cc/i);
    if (cc) s.engineCc = +cc[1];
    const cyl = raw._engine.match(/(\d+)\s*Cylinder/i);
    if (cyl) s.engineCyl = +cyl[1];
    const lo = raw._engine.toLowerCase();
    if (lo.includes('inline')) s.engineType = 'Inline';
    else if (lo.includes('v-type') || lo.includes('v type')) s.engineType = 'V-type';
    else if (lo.includes('flat')) s.engineType = 'Flat';
  }

  if (raw._fuelType) s.engineFuel = raw._fuelType.split(',')[0].trim();

  // Power: "148 bhp @ 5000 rpm"
  if (raw._maxPower) {
    const p = raw._maxPower.match(/([\d.]+)\s*(?:bhp|ps|hp)/i);
    if (p) s.powerPs = +p[1];
    const r = raw._maxPower.match(/@\s*([\d]+)/);
    if (r) s.powerRpm = +r[1];
  }

  // Torque: "250 Nm @ 1600-3500 rpm"
  if (raw._maxTorque) {
    const t = raw._maxTorque.match(/([\d.]+)\s*Nm/i);
    if (t) s.torqueNm = +t[1];
    const r = raw._maxTorque.match(/@\s*([\d]+)/);
    if (r) s.torqueRpm = +r[1];
  }

  if (raw._transmission) s.transmission = raw._transmission.split(',')[0].trim();
  if (raw._drivetrain) s.driveType = raw._drivetrain.trim();

  // Dimensions: "4221 mm L * 1760 mm W * 1612 mm H"
  if (raw._dimensions) {
    const nums = raw._dimensions.match(/(\d+)\s*mm/g);
    if (nums && nums.length >= 3) {
      s.lengthMm = parseInt(nums[0]);
      s.widthMm = parseInt(nums[1]);
      s.heightMm = parseInt(nums[2]);
    }
  }

  const intMm = (v: string | undefined) => {
    if (!v) return undefined;
    const m = v.match(/(\d+)\s*mm/i);
    return m ? +m[1] : undefined;
  };
  const intKg = (v: string | undefined) => {
    if (!v) return undefined;
    const m = v.match(/([\d]+)\s*kg/i);
    return m ? +m[1] : undefined;
  };
  const floatL = (v: string | undefined) => {
    if (!v) return undefined;
    const m = v.match(/([\d.]+)\s*(?:Litres|L)/i);
    return m ? +m[1] : undefined;
  };
  const firstInt = (v: string | undefined) => {
    if (!v) return undefined;
    const m = v.match(/(\d+)/);
    return m ? +m[1] : undefined;
  };
  const floatM = (v: string | undefined) => {
    if (!v) return undefined;
    const m = v.match(/([\d.]+)\s*m(?:etr|$|\s)/i);
    return m ? +m[1] : undefined;
  };

  s.wheelbaseMm = intMm(raw._wheelbase);
  s.kerbWeightKg = intKg(raw._kerbWeight);
  s.bootSpaceLitres = firstInt(raw._bootSpace);
  s.groundClearanceMm = intMm(raw._groundClearance);
  s.turningRadiusM = floatM(raw._turningRadius);
  s.fuelCapLitres = floatL(raw._fuelTank);
  s.seatingCapacity = firstInt(raw._seatingCapacity);
  s.doors = firstInt(raw._doors);
  s.airbagCount = firstInt(raw._airbags);

  if (raw._mileage) {
    const km = raw._mileage.match(/([\d.]+)\s*km/i);
    if (km) s.mileageCombined = +km[1];
  }

  if (raw._frontTyres) s.tyreSize = raw._frontTyres.trim();
  if (raw._wheelType) s.wheelType = raw._wheelType.trim();

  // NCAP rating value is itself the descriptive label, e.g.
  //   "NCAP Rating (Not Tested)"
  //   "NCAP Rating (5 Star Global NCAP, Adult)"
  //   "5 Star Global NCAP (Adult & Child)"
  // Extract stars + region; skip "Not Tested".
  if (raw._ncapRating && !/not\s*tested/i.test(raw._ncapRating)) {
    const adult = raw._ncapRating.match(/(\d)\s*star[^a-z]*(?:adult|global|bharat|euro|asean)/i);
    if (adult) s.ncapStarsAdult = +adult[1];
    const child = raw._ncapRating.match(/(\d)\s*star[^a-z]*child/i);
    if (child) s.ncapStarsChild = +child[1];
    const region = raw._ncapRating.match(/(global|bharat|euro|asean)\s*ncap/i);
    if (region) s.ncapRegion = `${region[1].toLowerCase()} ncap`;
  }

  // Full-page regex fallback disabled: scraping over the entire main element
  // catches comparison/related-variant blocks and produces false positives
  // (e.g. petrol cars mis-flagged with battery kWh values from a recommended
  // EV card). NCAP is now extracted via data-itemid 703 above. For ABS / ESP
  // / hill-hold / ISOFIX / ADAS the variant page only encodes presence via a
  // CSS class on an SVG icon (e.g. o-k3 = yes, o-k5 = no), which is too
  // brittle to depend on. Future work: detect class pairs per snapshot run
  // and translate to booleans.
  void TEXT_PATTERNS;
  void raw._fullText;

  return s;
}

function hasData(spec: ParsedSpec): boolean {
  return Object.values(spec).some((v) => v !== undefined);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  console.log('🔬 CarWale Spec Scraper (Puppeteer — robust variant extraction)');
  console.log('================================================================');

  // Iterate the catalog DB directly instead of snapshot files. Snapshot files
  // historically determined which models were scraped, but catalog models can
  // outnumber what any single snapshot file lists (e.g. Honda Elevate is in
  // the honda-cars snapshot, but Honda models also live in the broader honda
  // file). Driving from the DB picks up every car/SUV model that has a CarWale
  // sourceUrl.
  const dbMakes = await prisma.vehicleCatalogMake.findMany({
    where: {
      vehicleType: { in: ['car', 'suv'] },
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
    orderBy: { name: 'asc' },
  });

  console.log(`📂 ${dbMakes.length} make(s) to process\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  let totalModels = 0;
  let totalVariantsTested = 0;
  let totalUpserted = 0;
  let totalFailed = 0;

  for (const make of dbMakes) {
    console.log(`🏭 ${make.name} (${make.vehicleType})`);

    for (const model of make.models) {
      if (!model.sourceUrl) continue;
      totalModels++;

      const modelUrl = model.sourceUrl.replace(/\/$/, '') + '/';
      console.log(`   🚗 ${make.name} ${model.name}`);

      const extractedVariants = await extractVariantUrls(page, modelUrl);
      if (extractedVariants.length === 0) {
        console.log(`      ⚠️  Could not find variant links on model page`);
        await sleep(200);
        continue;
      }

      console.log(`      🔗 Found ${extractedVariants.length} variant links`);

      const dbVariants = model.generations
        .flatMap((g) => g.variants)
        .map((v) => ({ ...v }));

      const claimedIds = new Set<string>();

      for (const ev of extractedVariants) {
        totalVariantsTested++;

        const evSlug = ev.url.split('/').filter(Boolean).pop() ?? '';
        const evSlugNorm = evSlug.replace(/-/g, '');
        const evNameNorm = ev.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        let dbVariant = dbVariants.find((v) => v.slug === evSlug && !claimedIds.has(v.id));

        if (!dbVariant) {
          const candidates = dbVariants
            .filter((v) => !claimedIds.has(v.id))
            .map((v) => {
              const vSlugNorm = v.slug.replace(/-/g, '');
              const vNameNorm = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              let score = 0;
              if (vSlugNorm === evSlugNorm) score = 100;
              else if (vNameNorm === evNameNorm) score = 90;
              else if (vNameNorm && evNameNorm.startsWith(vNameNorm)) score = 60 + vNameNorm.length;
              else if (vNameNorm && evNameNorm.endsWith(vNameNorm)) score = 50 + vNameNorm.length;
              else if (vNameNorm && evNameNorm.includes(vNameNorm)) score = 30 + vNameNorm.length;
              else if (evSlugNorm && vNameNorm.includes(evSlugNorm)) score = 20 + evSlugNorm.length;
              return { v, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score);
          dbVariant = candidates[0]?.v;
        }

        if (dbVariant) claimedIds.add(dbVariant.id);
        if (!dbVariant) continue;
        if (dbVariant.spec && !args.force) continue;

        try {
          const rawSpecs = await scrapeVariantSpecs(page, ev.url);

          if (Object.keys(rawSpecs).length === 0) {
            totalFailed++;
            continue;
          }

          const parsed = parseRawSpecs(rawSpecs);

          if (!hasData(parsed)) {
            totalFailed++;
            continue;
          }

          if (args.dryRun) {
            console.log(`      📋 [DRY] ${dbVariant.name}: ${JSON.stringify(parsed).substring(0, 100)}…`);
          } else {
            await prisma.vehicleCatalogVariantSpec.upsert({
              where: { variantId: dbVariant.id },
              update: { ...parsed, sourceName: 'carwale-puppeteer' },
              create: { variantId: dbVariant.id, ...parsed, sourceName: 'carwale-puppeteer' },
            });
            console.log(`      ✅ Upserted ${dbVariant.name}`);
          }

          totalUpserted++;
        } catch (e) {
          console.log(`      ❌ Error scraping ${dbVariant.name}: ${e}`);
          totalFailed++;
        }

        await sleep(500);
      }

      await sleep(1000);
    }
  }

  try {
    await page.close();
  } catch {}
  try {
    await browser.close();
  } catch {}
  await prisma.$disconnect();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✨ Summary`);
  console.log(`   Models processed: ${totalModels}`);
  console.log(`   Variants tested:  ${totalVariantsTested}`);
  console.log(`   Specs upserted:   ${totalUpserted}`);
  console.log(`   Failed scrapes:   ${totalFailed}`);
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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
