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
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

// CarWale data-itemid → our internal field mapping
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
};

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
          if (
            [
              'price-in',
              'images',
              'videos',
              'compare',
              'colours',
              'mileage',
              'specifications',
              'features',
              'emi-calculator',
            ].includes(slug)
          ) {
            return;
          }

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

  return s;
}

function hasData(spec: ParsedSpec): boolean {
  return Object.values(spec).some((v) => v !== undefined);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const sourcesDir = resolve(__dirname, '../sources');

  console.log('🔬 CarWale Spec Scraper (Puppeteer — robust variant extraction)');
  console.log('================================================================');

  const snapshotFiles = readdirSync(sourcesDir).filter(
    (f) => f.endsWith('.snapshot.ts') && f.includes('-india'),
  );

  const filteredFiles = args.brand
    ? snapshotFiles.filter((f) => f.startsWith(args.brand!))
    : snapshotFiles;

  console.log(`📂 ${filteredFiles.length} snapshot file(s) to process\n`);

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

  for (const file of filteredFiles) {
    const brandSlug = file.replace('-india.snapshot.ts', '');
    console.log(`🏭 ${brandSlug}`);

    const snapshotModule = await import(resolve(sourcesDir, file));
    const snapshotKey = Object.keys(snapshotModule)[0];
    const snapshot = snapshotModule[snapshotKey];

    if (!snapshot?.dataset) {
      console.log(`   ⚠️  No dataset, skipping`);
      continue;
    }

    for (const makeData of snapshot.dataset) {
      for (const model of makeData.models) {
        if (!model.sourceUrl) continue;
        totalModels++;

        const modelUrl = model.sourceUrl.replace(/\/$/, '') + '/';
        console.log(`   🚗 ${makeData.name} ${model.name}`);

        // 1. Get exact variant URLs from the model page
        const extractedVariants = await extractVariantUrls(page, modelUrl);
        if (extractedVariants.length === 0) {
          console.log(`      ⚠️  Could not find variant links on model page`);
          await sleep(200);
          continue;
        }

        console.log(`      🔗 Found ${extractedVariants.length} variant links`);

        // Get DB variants for this model
        const dbVariants = await prisma.vehicleCatalogVariant.findMany({
          where: {
            generation: {
              model: {
                name: { equals: model.name, mode: 'insensitive' },
                make: {
                  name: { equals: makeData.name, mode: 'insensitive' },
                },
              },
            },
          },
          include: { spec: true },
        });

        for (const ev of extractedVariants) {
          totalVariantsTested++;

          // Match extracted variant against DB by slug or name-matching
          // The ev.name might be something like "Highline 1.0L TSI MT" while DB holds "Highline".
          // The best matching logic: find DB variant whose name is contained in the extracted name, or vice-versa
          const dbVariant = dbVariants.find((v) => {
            const vName = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const eName = ev.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            // Also check the URL slug
            const urlSlug = ev.url.split('/').filter(Boolean).pop()?.replace(/-/g, '');

            return (
              eName.includes(vName) || vName.includes(eName) || (urlSlug && vName.includes(urlSlug))
            );
          });

          if (!dbVariant) {
            // Skipping un-matched variant purely on client side
            continue;
          }

          if (dbVariant.spec && !args.force) {
            continue; // Already has specs
          }

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
              console.log(
                `      📋 [DRY] ${dbVariant.name}: ${JSON.stringify(parsed).substring(0, 100)}…`,
              );
            } else {
              await prisma.vehicleCatalogVariantSpec.upsert({
                where: { variantId: dbVariant.id },
                update: { ...parsed, sourceName: 'carwale-puppeteer' },
                create: {
                  variantId: dbVariant.id,
                  ...parsed,
                  sourceName: 'carwale-puppeteer',
                },
              });
              console.log(`      ✅ Upserted ${dbVariant.name}`);
            }

            totalUpserted++;
          } catch (e) {
            console.log(`      ❌ Error scraping ${dbVariant.name}: ${e}`);
            totalFailed++;
          }

          await sleep(500); // Be respectful per variant
        }

        await sleep(1000); // Between models
      }
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
