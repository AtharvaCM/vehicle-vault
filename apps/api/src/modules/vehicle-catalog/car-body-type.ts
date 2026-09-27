import { type CarBodyType, normaliseCarBodyType } from '@vehicle-vault/shared';

/**
 * Car body types for the catalog (#389): what a CarWale model page says, and
 * a curated fallback for the models it says nothing about.
 */

/**
 * The body type in a CarWale model page's structured data, as CarWale wrote
 * it ("SUV", "MuvsMpvs"), or null. Newer pages type the node
 * `["Car", "ProductGroup"]` rather than `"Car"`, so both are read.
 */
export function carWaleJsonLdBodyType(html: string): string | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body ?? '');
    } catch {
      continue;
    }
    for (const node of structuredDataNodes(parsed)) {
      if (!isCarNode(node)) continue;
      const bodyType = Array.isArray(node.bodyType) ? node.bodyType[0] : node.bodyType;
      if (typeof bodyType === 'string' && bodyType.trim()) return bodyType.trim();
    }
  }
  return null;
}

function structuredDataNodes(parsed: unknown): Array<Record<string, unknown>> {
  const roots = Array.isArray(parsed) ? parsed : [parsed];
  return roots.flatMap((root) => {
    if (!root || typeof root !== 'object') return [];
    const graph = (root as Record<string, unknown>)['@graph'];
    return Array.isArray(graph) ? graph : [root];
  }) as Array<Record<string, unknown>>;
}

export function isCarNode(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== 'object') return false;
  const type = (node as Record<string, unknown>)['@type'];
  return Array.isArray(type) ? type.includes('Car') : type === 'Car';
}

/**
 * Car models by make and model slug, checked by hand: ones CarWale's model
 * pages give no body type for, and ones where CarWale's is wrong (it calls
 * the Ioniq 6 an SUV). The table wins over CarWale and over a value on file.
 * Only models whose shape is not in doubt; one left out stays without a body
 * type and in no chip. Vans count as MUVs, as CarWale counts the Omni.
 */
const CURATED: Record<string, CarBodyType> = {
  // CarWale's label is wrong.
  'honda/mobilio': 'MUV',
  'hyundai/ioniq-6': 'Sedan',
  'mahindra/xylo': 'MUV',
  'nissan/evalia-2014-2016': 'MUV',
  'nissan/jonga': 'SUV',
  'renault/lodgy': 'MUV',
  'tata/movus': 'MUV',
  'toyota/innova-2015-2016': 'MUV',
  'toyota/mr2': 'Coupe',
  'toyota/prius': 'Hatchback',
  'toyota/qualis-2002-2004': 'MUV',

  // CarWale says nothing.
  'citroen/aircross': 'SUV',
  'force-motors/gurkha-2021-2024': 'SUV',
  'honda/amaze-2018-2021': 'Sedan',
  'honda/city-2023-2026': 'Sedan',
  'honda/city-hybrid-ehev': 'Sedan',
  'honda/concerto': 'Sedan',
  'honda/cr-x': 'Coupe',
  'honda/elevate-ev': 'SUV',
  'honda/wr-v': 'SUV',
  'hyundai/alcazar-2023-2024': 'SUV',
  'hyundai/casper': 'SUV',
  'hyundai/creta-2023-2024': 'SUV',
  'hyundai/new-kona': 'SUV',
  'hyundai/santa-fe-2014-2017': 'SUV',
  'hyundai/tucson': 'SUV',
  'hyundai/venue-n-line-2023-2025': 'SUV',
  'isuzu/d-max-2021-2024': 'Pickup',
  'isuzu/mu-x-2018-2020': 'SUV',
  'isuzu/trooper': 'SUV',
  'jeep/avenger': 'SUV',
  'jeep/grand-cherokee-2016-2020': 'SUV',
  'jeep/kaiser': 'SUV',
  'jeep/renegade': 'SUV',
  'jeep/willys': 'SUV',
  'mahindra/be-6-fe': 'SUV',
  'mahindra/ekuv100': 'SUV',
  'mahindra/nuvosport': 'SUV',
  'mahindra/quanto-2012-2016': 'SUV',
  'mahindra/xev-7e': 'SUV',
  'maruti-suzuki/baleno-2019-2022': 'Hatchback',
  'maruti-suzuki/celerio-2017-2021': 'Hatchback',
  'maruti-suzuki/eeco-2010-2022': 'MUV',
  'maruti-suzuki/fronx-flex-fuel': 'SUV',
  'maruti-suzuki/futuro-e': 'SUV',
  'maruti-suzuki/s-cross': 'SUV',
  'maruti-suzuki/wagonr': 'Hatchback',
  'mg/5-estate': 'Wagon',
  'mg/ehs': 'SUV',
  'mg/erx5': 'SUV',
  'mg/euniq-7': 'MUV',
  'mg/hector-plus-2023-2025': 'SUV',
  'mg/marvel-r': 'SUV',
  'nissan/bluebird': 'Sedan',
  'nissan/cedric': 'Sedan',
  'nissan/fairlady-300-zx': 'Coupe',
  'nissan/gt-r': 'Coupe',
  'nissan/juke': 'SUV',
  'nissan/laurel': 'Sedan',
  'nissan/leaf-ev': 'Hatchback',
  'nissan/murano': 'SUV',
  'nissan/nv350': 'MUV',
  'nissan/patrol': 'SUV',
  'nissan/qashqai': 'SUV',
  'nissan/safari-granroad': 'SUV',
  'nissan/serena': 'MUV',
  'nissan/teana-2007-2014': 'Sedan',
  'nissan/x-trail-2009-2014': 'SUV',
  'renault/kwid-2022-2023': 'Hatchback',
  'renault/scenic': 'MUV',
  'skoda/kamiq': 'SUV',
  'skoda/karoq': 'SUV',
  'skoda/kushaq-2024-2026': 'SUV',
  'skoda/octavia': 'Sedan',
  'tata/tigor-2018-2020': 'Sedan',
  'toyota/belta': 'Sedan',
  'toyota/celica': 'Coupe',
  'toyota/commuter': 'MUV',
  'toyota/corolla-ceres': 'Sedan',
  'toyota/cressida': 'Sedan',
  'toyota/cresta': 'Sedan',
  'toyota/estima': 'MUV',
  'toyota/hiace': 'MUV',
  'toyota/innova-crysta-2023-2026': 'MUV',
  'toyota/land-cruiser-2015-2020': 'SUV',
  'toyota/land-cruiser-prado': 'SUV',
  'toyota/majesta': 'Sedan',
  'toyota/mark-ii': 'Sedan',
  'toyota/masterace': 'MUV',
  'toyota/rav-4': 'SUV',
  'toyota/rush': 'SUV',
  'toyota/tundra': 'Pickup',
  'toyota/vellfire-2014': 'MUV',
  'toyota/vellfire-2020-2023': 'MUV',
  'toyota/ventury': 'MUV',
  'volkswagen/caravelle': 'MUV',
  'volkswagen/phaeton': 'Sedan',
  'volkswagen/tiguan-allspace': 'SUV',
  'volkswagen/touareg': 'SUV',
  'volkswagen/transporter': 'MUV',
};

export function curatedCarBodyType(makeSlug: string, modelSlug: string): CarBodyType | null {
  return CURATED[`${makeSlug}/${modelSlug}`] ?? null;
}

export type CarBodyTypeFill =
  /** The field is empty: write the model's body type. */
  | { action: 'fill'; bodyType: CarBodyType }
  /** The field holds a source's label ("MuvsMpvs"): write the catalog's for it. */
  | { action: 'relabel'; bodyType: CarBodyType }
  /** The curated table says the value on file is wrong. */
  | { action: 'correct'; bodyType: CarBodyType }
  | { action: 'none' };

/**
 * What to write into one variant's `bodyType`. A value already on file wins
 * over a scraped model body type, since a variant can differ from its model;
 * only its label is brought into line. A curated one (`authoritative`) wins
 * over the value on file.
 */
export function carBodyTypeFill(
  stored: string | null | undefined,
  modelBodyType: CarBodyType | null,
  { authoritative = false }: { authoritative?: boolean } = {},
): CarBodyTypeFill {
  if (!stored) {
    return modelBodyType ? { action: 'fill', bodyType: modelBodyType } : { action: 'none' };
  }
  const normalised = normaliseCarBodyType(stored);
  if (authoritative && modelBodyType && normalised !== modelBodyType) {
    return { action: 'correct', bodyType: modelBodyType };
  }
  return normalised && normalised !== stored
    ? { action: 'relabel', bodyType: normalised }
    : { action: 'none' };
}
