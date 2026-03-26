import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  fetchPage,
  parseBrandList,
  parseModelList,
  parseVariantList,
  classifyVehicleType,
  mapFuelType,
  type ScrapedBrand,
  type ScrapedModel,
} from './carwale-parser';

import type {
  CatalogDataset,
  CatalogMakeInput,
  CatalogModelInput,
  CatalogGenerationInput,
} from '../types';

// Top Indian market brands to scrape (CarWale slugs)
const INDIAN_MARKET_BRANDS = [
  'maruti-suzuki',
  'tata',
  'mahindra',
  'hyundai',
  'toyota',
  'renault',
  'skoda',
  'kia',
  'volkswagen',
  'honda',
  'nissan',
  'mg',
  'citroen',
  'jeep',
  'byd',
  'force-motors',
  'isuzu',
];

async function main() {
  const args = parseArgs();
  const brandsToScrape = args.brand ? [args.brand] : INDIAN_MARKET_BRANDS;
  const outputDir = resolve(__dirname, '../sources');

  console.log(`🚗 CarWale Catalog Scraper`);
  console.log(`========================`);
  console.log(`Brands to scrape: ${brandsToScrape.join(', ')}`);
  console.log(`Output directory: ${outputDir}`);
  console.log();

  // Step 1: Get the brand list from CarWale to resolve display names
  console.log('📋 Fetching brand list from CarWale...');
  const brandListHtml = await fetchPage('https://www.carwale.com/new-cars/', 500);
  const allBrands = parseBrandList(brandListHtml);
  console.log(`   Found ${allBrands.length} brands on CarWale\n`);

  for (const brandSlug of brandsToScrape) {
    const brandInfo = allBrands.find((b) => b.slug === brandSlug);
    const brandName = brandInfo?.name || toTitleCase(brandSlug.replace(/-/g, ' '));

    console.log(`\n🏭 Scraping: ${brandName} (${brandSlug})`);
    console.log(`${'─'.repeat(40)}`);

    try {
      const dataset = await scrapeBrand(brandSlug, brandName);

      if (dataset.length === 0) {
        console.log(`   ⚠️  No data extracted for ${brandName}, skipping.`);
        continue;
      }

      // Generate the snapshot file content
      const snapshotContent = generateSnapshotFile(brandSlug, brandName, dataset);
      const outputFile = resolve(outputDir, `${brandSlug}-india.snapshot.ts`);

      if (args.dryRun) {
        console.log(`   🔍 [DRY RUN] Would write to: ${outputFile}`);
        console.log(`   Models: ${dataset.flatMap((m) => m.models.map((x) => x.name)).join(', ')}`);
      } else {
        writeFileSync(outputFile, snapshotContent, 'utf-8');
        console.log(`   ✅ Wrote snapshot to: ${outputFile}`);
      }

      // Summary
      const totalModels = dataset.reduce((sum, d) => sum + d.models.length, 0);
      const totalVariants = dataset.reduce(
        (sum, d) =>
          sum +
          d.models.reduce(
            (ms, m) => ms + m.generations.reduce((gs, g) => gs + g.variants.length, 0),
            0,
          ),
        0,
      );
      console.log(`   📊 ${totalModels} models, ${totalVariants} variants`);
    } catch (error) {
      console.error(
        `   ❌ Error scraping ${brandName}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log('\n✨ Scraping complete!');
  if (!args.dryRun) {
    console.log('Run `pnpm catalog:import:all --publish` to import the data.');
  }
}

async function scrapeBrand(brandSlug: string, brandName: string): Promise<CatalogDataset> {
  // Fetch the brand page
  const brandHtml = await fetchPage(`https://www.carwale.com/${brandSlug}-cars/`, 800);
  const models = parseModelList(brandHtml, brandSlug);

  console.log(`   Found ${models.length} models`);

  // Group models by vehicle type (car vs SUV)
  const carModels: CatalogModelInput[] = [];
  const suvModels: CatalogModelInput[] = [];

  for (const model of models) {
    console.log(
      `   📦 Scraping model: ${model.name} (${model.isCurrent ? 'current' : 'discontinued'})`,
    );

    try {
      const modelHtml = await fetchPage(model.url, 600);
      const variants = parseVariantList(modelHtml);

      // If no variants found, create a "Standard" default
      const catalogVariants =
        variants.length > 0
          ? variants.map((v) => ({
              name: v.name,
              offerings: [
                {
                  fuelTypes: [mapFuelType(v.fuelType)] as any[],
                  yearStart: model.isCurrent ? 2020 : undefined,
                  isCurrent: model.isCurrent || undefined,
                },
              ],
            }))
          : [
              {
                name: 'Standard',
                offerings: [
                  {
                    fuelTypes: ['petrol' as any],
                    yearStart: model.isCurrent ? 2020 : undefined,
                    isCurrent: model.isCurrent || undefined,
                  },
                ],
              },
            ];

      const generation: CatalogGenerationInput = {
        name: `${model.name} (current)`,
        isCurrent: model.isCurrent,
        variants: catalogVariants,
      };

      const catalogModel: CatalogModelInput = {
        name: model.name,
        sourceUrl: model.url,
        generations: [generation],
      };

      const vehicleType = classifyVehicleType(model.name);
      if (vehicleType === 'suv') {
        suvModels.push(catalogModel);
      } else {
        carModels.push(catalogModel);
      }
    } catch (error) {
      console.log(
        `      ⚠️  Failed to scrape variants for ${model.name}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  const dataset: CatalogDataset = [];

  if (carModels.length > 0) {
    dataset.push({
      marketCode: 'IN',
      vehicleType: 'car' as any,
      name: brandName,
      sourceUrl: `https://www.carwale.com/${brandSlug}-cars/`,
      models: carModels,
    });
  }

  if (suvModels.length > 0) {
    dataset.push({
      marketCode: 'IN',
      vehicleType: 'suv' as any,
      name: brandName,
      sourceUrl: `https://www.carwale.com/${brandSlug}-cars/`,
      models: suvModels,
    });
  }

  return dataset;
}

function generateSnapshotFile(
  brandSlug: string,
  brandName: string,
  dataset: CatalogDataset,
): string {
  const varName = toCamelCase(brandSlug) + 'IndiaSnapshot';
  const today = new Date().toISOString().split('T')[0];

  return `import type { CatalogImportSource } from '../types';

export const ${varName}: CatalogImportSource = ${JSON.stringify(
    {
      marketCode: 'IN',
      sourceKey: `${brandSlug}-india`,
      sourceUrl: `https://www.carwale.com/${brandSlug}-cars/`,
      capturedAt: today,
      dataset,
    },
    null,
    2,
  )};
`;
}

function parseArgs() {
  const brandArg = process.argv.find((a) => a.startsWith('--brand='));
  const dryRun = process.argv.includes('--dry-run');
  return {
    brand: brandArg?.split('=')[1],
    dryRun,
  };
}

function toTitleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toCamelCase(str: string) {
  return str
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
