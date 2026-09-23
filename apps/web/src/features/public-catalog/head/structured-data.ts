import { FuelType, type PublicCatalogVariantPage } from '@vehicle-vault/shared';

import { formatFuelType } from '../utils/format-public-catalog';

/** A schema.org JSON-LD object. */
export type JsonLd = { [key: string]: JsonLdValue };
type JsonLdValue = string | number | boolean | JsonLd | JsonLdValue[];

/** The id of the one JSON-LD `<script>` a public page carries, so the client can find and swap it. */
export const STRUCTURED_DATA_ELEMENT_ID = 'vv-structured-data';

/**
 * schema.org `Car` (everything under `/cars`, SUVs and vans included) or
 * `Motorcycle` (`/bikes`) for a variant page. Only facts the catalog has go in:
 * a missing spec is left out, never sent as null or zero.
 */
export function variantPageStructuredData(
  page: PublicCatalogVariantPage,
  canonicalUrl: string,
): JsonLd {
  const specs = page.specs;
  const fuelType = page.calculatorSeed.fuelType;
  const electric = fuelType === FuelType.Electric;
  const fuelTypes = [...new Set(page.offerings.flatMap((offering) => offering.fuelTypes))];

  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': page.segment === 'bikes' ? 'Motorcycle' : 'Car',
    name: `${page.make.name} ${page.model.name} ${page.variant.name}`,
    url: canonicalUrl,
    brand: { '@type': 'Brand', name: page.make.name },
    model: page.model.name,
    vehicleConfiguration: page.variant.name,
  };
  const fuels = (fuelTypes.length > 0 ? fuelTypes : [fuelType]).map(formatFuelType);
  data.fuelType = fuels.length === 1 ? fuels[0]! : fuels;
  if (page.generation.yearStart) data.vehicleModelDate = String(page.generation.yearStart);

  if (!specs) return data;

  const engineFacts = compact({
    engineType: specs.engineType ?? undefined,
    engineDisplacement: quantity(specs.engineCc, { unitCode: 'CMQ' }),
    enginePower: electric
      ? (quantity(specs.motorKw, { unitCode: 'KWT' }) ??
        quantity(specs.powerPs, { unitText: 'PS' }))
      : quantity(specs.powerPs, { unitText: 'PS' }),
    torque: quantity(specs.torqueNm, { unitCode: 'NU' }),
  });
  if (Object.keys(engineFacts).length > 0) {
    data.vehicleEngine = {
      '@type': 'EngineSpecification',
      ...(electric && !engineFacts.engineType ? { engineType: 'Electric motor' } : {}),
      fuelType: formatFuelType(fuelType),
      ...engineFacts,
    };
  }

  if (!electric) {
    const efficiency = quantity(specs.mileageCombined, {
      unitText: fuelType === FuelType.CNG ? 'km/kg' : 'km/L',
    });
    if (efficiency) data.fuelEfficiency = efficiency;
  }

  Object.assign(
    data,
    compact({
      bodyType: specs.bodyType ?? undefined,
      vehicleTransmission: specs.transmission ?? undefined,
      driveWheelConfiguration: specs.driveType ?? undefined,
      numberOfForwardGears: specs.gearCount ?? undefined,
      seatingCapacity: specs.seatingCapacity ?? undefined,
      numberOfDoors: specs.doors ?? undefined,
      fuelCapacity: electric ? undefined : quantity(specs.fuelCapLitres, { unitCode: 'LTR' }),
      weight: quantity(specs.kerbWeightKg, { unitCode: 'KGM' }),
      speed: quantity(specs.topSpeedKph, { unitCode: 'KMH' }),
    }),
  );

  if (electric) {
    const properties = [
      property('Claimed range', specs.rangeKm, 'KMT'),
      property('Battery capacity', specs.batteryKwh, 'KWH'),
    ].filter((entry): entry is JsonLd => entry !== undefined);
    if (properties.length > 0) data.additionalProperty = properties;
  }

  return data;
}

/**
 * JSON for inside a `<script type="application/ld+json">`: still valid JSON,
 * but with nothing that can close the element (`</script>`), open a comment
 * (`<!--`) or start an entity, whatever a catalog name contains.
 */
export function serializeStructuredData(data: JsonLd) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

type Unit = { unitCode: string } | { unitText: string };

function quantity(value: number | null, unit: Unit): JsonLd | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  return { '@type': 'QuantitativeValue', value, ...unit };
}

function property(name: string, value: number | null, unitCode: string): JsonLd | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  return { '@type': 'PropertyValue', name, value, unitCode };
}

function compact(entries: Record<string, JsonLdValue | undefined>): JsonLd {
  return Object.fromEntries(
    Object.entries(entries).filter(
      (entry): entry is [string, JsonLdValue] => entry[1] !== undefined && entry[1] !== '',
    ),
  );
}
