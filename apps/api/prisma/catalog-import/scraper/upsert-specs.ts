/**
 * Upsert vehicle catalog variant specs.
 *
 * Usage:
 *   ts-node prisma/catalog-import/scraper/upsert-specs.ts --file=specs.json
 *
 * The JSON file should contain an array of spec objects matching the schema fields,
 * with `make`, `model`, and `variant` fields to identify the target variant.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SpecInput = {
  make: string;
  model: string;
  variant: string;
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
  grossWeightKg?: number;
  bootSpaceLitres?: number;
  groundClearanceMm?: number;
  turningRadiusM?: number;
  topSpeedKph?: number;
  mileageCity?: number;
  mileageHighway?: number;
  mileageCombined?: number;
  fuelCapLitres?: number;
  seatingCapacity?: number;
  bodyType?: string;
  doors?: number;
  tyreSize?: string;
  wheelType?: string;
  wheelSizeInch?: number;
  airbagCount?: number;
  safetyFeatures?: string;
  sourceName?: string;
};

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));

  let specs: SpecInput[];

  if (fileArg) {
    const filePath = fileArg.split('=')[1];
    const contents = readFileSync(filePath, 'utf-8');
    specs = JSON.parse(contents);
  } else {
    // Use built-in seed data
    specs = getSeedSpecs();
  }

  console.log(`📋 Upserting specs for ${specs.length} variants...`);

  let success = 0;
  let skipped = 0;

  for (const spec of specs) {
    // Find the variant by name match
    const variant = await prisma.vehicleCatalogVariant.findFirst({
      where: {
        name: { equals: spec.variant, mode: 'insensitive' },
        generation: {
          model: {
            name: { equals: spec.model, mode: 'insensitive' },
            make: {
              name: { equals: spec.make, mode: 'insensitive' },
            },
          },
        },
      },
    });

    if (!variant) {
      console.log(`   ⚠️  Variant not found: ${spec.make} ${spec.model} ${spec.variant}`);
      skipped++;
      continue;
    }

    const { make, model, variant: _variant, ...specData } = spec;

    await prisma.vehicleCatalogVariantSpec.upsert({
      where: { variantId: variant.id },
      update: { ...specData },
      create: {
        variantId: variant.id,
        ...specData,
      },
    });

    console.log(`   ✅ ${spec.make} ${spec.model} ${spec.variant}`);
    success++;
  }

  console.log(`\n✨ Done! ${success} upserted, ${skipped} skipped.`);
  await prisma.$disconnect();
}

function getSeedSpecs(): SpecInput[] {
  return [
    // Volkswagen Taigun variants
    {
      make: 'Volkswagen',
      model: 'Taigun',
      variant: 'Comfortline',
      engineCc: 999,
      engineCyl: 3,
      engineType: 'Inline',
      engineFuel: 'Petrol',
      powerPs: 115,
      powerRpm: 5000,
      torqueNm: 178,
      torqueRpm: 1750,
      transmission: '6-speed MT',
      driveType: 'FWD',
      lengthMm: 4221,
      widthMm: 1760,
      heightMm: 1612,
      wheelbaseMm: 2651,
      kerbWeightKg: 1250,
      bootSpaceLitres: 385,
      groundClearanceMm: 188,
      turningRadiusM: 5.1,
      mileageCity: 15.5,
      mileageHighway: 19.6,
      fuelCapLitres: 50,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '205/65 R16',
      wheelType: 'Steel',
      wheelSizeInch: 16,
      airbagCount: 2,
      safetyFeatures: '["ABS","EBD","ESC","Hill Hold","Rear Parking Sensors","ISOFIX"]',
      sourceName: 'carwale-seed',
    },
    {
      make: 'Volkswagen',
      model: 'Taigun',
      variant: 'GT Plus',
      engineCc: 1498,
      engineCyl: 4,
      engineType: 'Inline',
      engineFuel: 'Petrol',
      powerPs: 150,
      powerRpm: 5000,
      torqueNm: 250,
      torqueRpm: 1600,
      transmission: '7-speed DSG',
      driveType: 'FWD',
      lengthMm: 4221,
      widthMm: 1760,
      heightMm: 1612,
      wheelbaseMm: 2651,
      kerbWeightKg: 1310,
      bootSpaceLitres: 385,
      groundClearanceMm: 188,
      turningRadiusM: 5.1,
      topSpeedKph: 195,
      mileageCity: 14.1,
      mileageHighway: 18.4,
      fuelCapLitres: 50,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/55 R17',
      wheelType: 'Alloy',
      wheelSizeInch: 17,
      airbagCount: 6,
      safetyFeatures:
        '["ABS","EBD","ESC","Hill Hold","Rear Parking Sensors","Reverse Camera","Tyre Pressure Monitor","ISOFIX","6 Airbags"]',
      sourceName: 'carwale-seed',
    },
    {
      make: 'Volkswagen',
      model: 'Virtus',
      variant: 'GT Plus',
      engineCc: 1498,
      engineCyl: 4,
      engineType: 'Inline',
      engineFuel: 'Petrol',
      powerPs: 150,
      powerRpm: 5000,
      torqueNm: 250,
      torqueRpm: 1600,
      transmission: '7-speed DSG',
      driveType: 'FWD',
      lengthMm: 4561,
      widthMm: 1752,
      heightMm: 1507,
      wheelbaseMm: 2651,
      kerbWeightKg: 1275,
      bootSpaceLitres: 521,
      groundClearanceMm: 179,
      turningRadiusM: 5.0,
      topSpeedKph: 190,
      mileageCity: 14.5,
      mileageHighway: 18.6,
      fuelCapLitres: 45,
      seatingCapacity: 5,
      bodyType: 'Sedan',
      doors: 4,
      tyreSize: '205/55 R16',
      wheelType: 'Alloy',
      wheelSizeInch: 16,
      airbagCount: 6,
      safetyFeatures:
        '["ABS","EBD","ESC","Hill Hold","Rear Parking Sensors","Reverse Camera","Tyre Pressure Monitor","ISOFIX","6 Airbags"]',
      sourceName: 'carwale-seed',
    },
    // Hyundai Creta
    {
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      engineCc: 1497,
      engineCyl: 4,
      engineType: 'Inline',
      engineFuel: 'Petrol',
      powerPs: 115,
      powerRpm: 6300,
      torqueNm: 144,
      torqueRpm: 4500,
      transmission: '6-speed MT',
      driveType: 'FWD',
      lengthMm: 4330,
      widthMm: 1790,
      heightMm: 1635,
      wheelbaseMm: 2610,
      kerbWeightKg: 1320,
      bootSpaceLitres: 433,
      groundClearanceMm: 190,
      mileageCity: 14.5,
      mileageHighway: 18.5,
      fuelCapLitres: 50,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/60 R17',
      wheelType: 'Alloy',
      wheelSizeInch: 17,
      airbagCount: 6,
      safetyFeatures: '["ABS","EBD","ESC","Hill Assist","TPMS","ISOFIX","6 Airbags","360° Camera"]',
      sourceName: 'carwale-seed',
    },
    // Tata Nexon
    {
      make: 'Tata',
      model: 'Nexon',
      variant: 'XZ+ P',
      engineCc: 1199,
      engineCyl: 3,
      engineType: 'Inline',
      engineFuel: 'Petrol',
      powerPs: 120,
      powerRpm: 5500,
      torqueNm: 170,
      torqueRpm: 1750,
      transmission: '6-speed MT',
      driveType: 'FWD',
      lengthMm: 3993,
      widthMm: 1811,
      heightMm: 1606,
      wheelbaseMm: 2498,
      kerbWeightKg: 1260,
      bootSpaceLitres: 350,
      groundClearanceMm: 209,
      mileageCity: 14.0,
      mileageHighway: 17.8,
      fuelCapLitres: 44,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/60 R16',
      wheelType: 'Alloy',
      wheelSizeInch: 16,
      airbagCount: 6,
      safetyFeatures:
        '["ABS","EBD","ESC","Hill Hold","TPMS","ISOFIX","6 Airbags","Reverse Camera"]',
      sourceName: 'carwale-seed',
    },
    // Maruti Suzuki Brezza
    {
      make: 'Maruti Suzuki',
      model: 'Brezza',
      variant: 'ZXi+',
      engineCc: 1462,
      engineCyl: 4,
      engineType: 'Inline',
      engineFuel: 'Petrol',
      powerPs: 103,
      powerRpm: 6000,
      torqueNm: 137,
      torqueRpm: 4400,
      transmission: '5-speed MT',
      driveType: 'FWD',
      lengthMm: 3995,
      widthMm: 1790,
      heightMm: 1685,
      wheelbaseMm: 2500,
      kerbWeightKg: 1185,
      bootSpaceLitres: 328,
      groundClearanceMm: 198,
      mileageCity: 15.0,
      mileageHighway: 20.2,
      fuelCapLitres: 48,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/60 R16',
      wheelType: 'Alloy',
      wheelSizeInch: 16,
      airbagCount: 6,
      safetyFeatures:
        '["ABS","EBD","ESC","Hill Hold","TPMS","ISOFIX","6 Airbags","360° Camera","Head-Up Display"]',
      sourceName: 'carwale-seed',
    },
    // Mahindra Thar Roxx
    {
      make: 'Mahindra',
      model: 'Thar Roxx',
      variant: 'MX5',
      engineCc: 2184,
      engineCyl: 4,
      engineType: 'Inline',
      engineFuel: 'Diesel',
      powerPs: 152,
      powerRpm: 3500,
      torqueNm: 360,
      torqueRpm: 1600,
      transmission: '6-speed MT',
      driveType: 'RWD',
      lengthMm: 4428,
      widthMm: 1870,
      heightMm: 1923,
      wheelbaseMm: 2850,
      kerbWeightKg: 2070,
      bootSpaceLitres: 644,
      groundClearanceMm: 226,
      mileageCity: 13.5,
      mileageHighway: 16.2,
      fuelCapLitres: 57,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '245/65 R17',
      wheelType: 'Alloy',
      wheelSizeInch: 17,
      airbagCount: 6,
      safetyFeatures:
        '["ABS","EBD","ESC","Hill Hold","Hill Descent","TPMS","ISOFIX","6 Airbags","Rear Parking Camera"]',
      sourceName: 'carwale-seed',
    },
  ];
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
