/**
 * Upsert vehicle catalog variant specs.
 *
 * Usage:
 *   pnpm catalog:seed-specs
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
  ncapStarsAdult?: number;
  ncapStarsChild?: number;
  ncapRegion?: string;
  hasAbs?: boolean;
  hasEsc?: boolean;
  hasTpms?: boolean;
  hasHillHoldAssist?: boolean;
  isofixPoints?: number;
  adasFeatures?: string;
  batteryKwh?: number;
  rangeKm?: number;
  motorKw?: number;
  acChargeKw?: number;
  dcFastChargeKw?: number;
  chargeTime0To80Min?: number;
  batteryChemistry?: string;
  gearCount?: number;
  coolingType?: string;
  frameType?: string;
  seatHeightMm?: number;
  brakeFrontType?: string;
  brakeRearType?: string;
  absChannels?: number;
  payloadKg?: number;
  gvwKg?: number;
  cargoVolumeL?: number;
  towingCapacityKg?: number;
  axleConfig?: string;
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
      variant: 'Creative Plus (PS)',
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
      variant: 'ZXi Plus',
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
      variant: 'Roxx MX5',
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
    // EVs
    {
      make: 'Tata',
      model: 'Nexon EV',
      variant: 'EV Empowered Plus A',
      engineFuel: 'Electric',
      transmission: 'Single-speed automatic',
      driveType: 'FWD',
      lengthMm: 3994,
      widthMm: 1811,
      heightMm: 1616,
      wheelbaseMm: 2498,
      bootSpaceLitres: 350,
      groundClearanceMm: 205,
      rangeKm: 465,
      batteryKwh: 40.5,
      motorKw: 106.4,
      acChargeKw: 7.2,
      chargeTime0To80Min: 56,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/60 R16',
      wheelType: 'Alloy',
      wheelSizeInch: 16,
      airbagCount: 6,
      hasAbs: true,
      hasEsc: true,
      hasTpms: true,
      isofixPoints: 2,
      safetyFeatures: '["ABS","EBD","ESC","TPMS","ISOFIX","6 Airbags","360° Camera","Hill Hold"]',
      sourceName: 'curated-seed',
    },
    {
      make: 'BYD',
      model: 'Atto 3',
      variant: '3 Superior',
      engineFuel: 'Electric',
      transmission: 'Single-speed automatic',
      driveType: 'FWD',
      lengthMm: 4455,
      widthMm: 1875,
      heightMm: 1615,
      wheelbaseMm: 2720,
      bootSpaceLitres: 440,
      rangeKm: 521,
      batteryKwh: 60.48,
      motorKw: 150,
      acChargeKw: 7,
      dcFastChargeKw: 80,
      chargeTime0To80Min: 50,
      batteryChemistry: 'LFP',
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/55 R18',
      wheelType: 'Alloy',
      wheelSizeInch: 18,
      airbagCount: 7,
      ncapStarsAdult: 5,
      ncapRegion: 'Euro NCAP',
      hasAbs: true,
      hasEsc: true,
      hasTpms: true,
      isofixPoints: 2,
      adasFeatures: '["AEB","Adaptive Cruise Control","Lane Keep Assist","Blind Spot Monitoring"]',
      safetyFeatures: '["ABS","EBD","ESC","TPMS","ISOFIX","7 Airbags","ADAS","360° Camera"]',
      sourceName: 'curated-seed',
    },
    {
      make: 'MG',
      model: 'ZS EV',
      variant: 'EV Exclusive Plus',
      engineFuel: 'Electric',
      transmission: 'Single-speed automatic',
      driveType: 'FWD',
      lengthMm: 4323,
      widthMm: 1809,
      heightMm: 1649,
      wheelbaseMm: 2585,
      bootSpaceLitres: 448,
      rangeKm: 461,
      batteryKwh: 50.3,
      motorKw: 130,
      dcFastChargeKw: 50,
      chargeTime0To80Min: 60,
      seatingCapacity: 5,
      bodyType: 'SUV',
      doors: 4,
      tyreSize: '215/55 R17',
      wheelType: 'Alloy',
      wheelSizeInch: 17,
      airbagCount: 6,
      hasAbs: true,
      hasEsc: true,
      hasTpms: true,
      isofixPoints: 2,
      safetyFeatures: '["ABS","EBD","ESC","TPMS","ISOFIX","6 Airbags","360° Camera"]',
      sourceName: 'curated-seed',
    },
    // Motorcycles
    {
      make: 'Royal Enfield',
      model: 'Classic 350',
      variant: 'Dark',
      engineCc: 349,
      engineCyl: 1,
      engineType: 'Single-cylinder',
      engineFuel: 'Petrol',
      powerPs: 20.2,
      powerRpm: 6100,
      torqueNm: 27,
      torqueRpm: 4000,
      transmission: '5-speed MT',
      gearCount: 5,
      coolingType: 'air-oil-cooled',
      frameType: 'Twin downtube spine frame',
      lengthMm: 2145,
      widthMm: 785,
      heightMm: 1090,
      wheelbaseMm: 1390,
      kerbWeightKg: 195,
      groundClearanceMm: 170,
      seatHeightMm: 805,
      fuelCapLitres: 13,
      mileageCombined: 35,
      bodyType: 'Cruiser',
      tyreSize: '100/90-19 front, 120/80-18 rear',
      brakeFrontType: 'Disc',
      brakeRearType: 'Disc',
      hasAbs: true,
      absChannels: 2,
      sourceName: 'curated-seed',
    },
    {
      make: 'Yamaha',
      model: 'R15',
      variant: 'M',
      engineCc: 155,
      engineCyl: 1,
      engineType: 'Single-cylinder VVA',
      engineFuel: 'Petrol',
      powerPs: 18.4,
      powerRpm: 10000,
      torqueNm: 14.2,
      torqueRpm: 7500,
      transmission: '6-speed MT',
      gearCount: 6,
      coolingType: 'liquid-cooled',
      frameType: 'Deltabox',
      lengthMm: 1990,
      widthMm: 725,
      heightMm: 1135,
      wheelbaseMm: 1325,
      kerbWeightKg: 142,
      groundClearanceMm: 170,
      seatHeightMm: 815,
      fuelCapLitres: 11,
      mileageCombined: 45,
      topSpeedKph: 140,
      bodyType: 'Sport',
      tyreSize: '100/80-17 front, 140/70-17 rear',
      brakeFrontType: 'Disc',
      brakeRearType: 'Disc',
      hasAbs: true,
      absChannels: 2,
      sourceName: 'curated-seed',
    },
    {
      make: 'Bajaj',
      model: 'Pulsar NS200',
      variant: 'Dual Channel ABS',
      engineCc: 199.5,
      engineCyl: 1,
      engineType: 'Single-cylinder',
      engineFuel: 'Petrol',
      powerPs: 24.5,
      powerRpm: 9750,
      torqueNm: 18.74,
      torqueRpm: 8000,
      transmission: '6-speed MT',
      gearCount: 6,
      coolingType: 'liquid-cooled',
      frameType: 'Perimeter frame',
      lengthMm: 2017,
      widthMm: 804,
      heightMm: 1075,
      wheelbaseMm: 1363,
      kerbWeightKg: 158,
      groundClearanceMm: 168,
      seatHeightMm: 805,
      fuelCapLitres: 12,
      mileageCombined: 36,
      bodyType: 'Street',
      tyreSize: '100/80-17 front, 130/70-17 rear',
      brakeFrontType: 'Disc',
      brakeRearType: 'Disc',
      hasAbs: true,
      absChannels: 2,
      sourceName: 'curated-seed',
    },
  ];
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
