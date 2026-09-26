/**
 * The curated fallback for two-wheeler final drive and cooling (#235), used
 * where the bike spec source says nothing. It decides only two service items:
 * chain service needs `driveType` to say chain, and coolant needs
 * `coolingType` to say liquid (see `MaintenanceIntervalResolver`), so the
 * table errs towards leaving a field empty over guessing it.
 */
export type TwoWheelerFacts = {
  make: string;
  model: string;
  bodyType: string | null;
  transmission: string | null;
};

export type DriveCooling = {
  driveType?: 'chain' | 'belt' | 'shaft';
  coolingType?: 'liquid-cooled';
};

/** Scooters sold in India, by name, for rows with no body type on file. */
const SCOOTER_MODELS =
  /\b(activa|dio|jupiter|ntorq|scooty|zest|access|burgman|avenis|fascino|ray ?zr|aerox|pleasure|destini|maestro|xoom|chetak|iqube|rizta|vida|s1|450 ?[xs]|ntorq)\b/i;

/** Motorcycles that are not chain-driven: shaft (BMW's boxers and K bikes) or belt. */
const NOT_CHAIN: Array<{ make: RegExp; model: RegExp; driveType: 'belt' | 'shaft' }> = [
  { make: /bmw/i, model: /^(r|k)\s?\d/i, driveType: 'shaft' },
  // Harley-Davidson's big twins run on a belt; the X440 is chain-driven.
  { make: /harley/i, model: /^(?!x\s?440)/i, driveType: 'belt' },
  { make: /revolt/i, model: /./, driveType: 'belt' },
  { make: /tork/i, model: /./, driveType: 'belt' },
];

/** Liquid-cooled motorcycles common in India. Air- and oil-cooled ones stay empty. */
const LIQUID_COOLED: Array<{ make: RegExp; model: RegExp }> = [
  { make: /ktm/i, model: /./ },
  { make: /husqvarna/i, model: /./ },
  { make: /kawasaki/i, model: /ninja|^z\s?\d|versys/i },
  { make: /yamaha/i, model: /r15|mt[\s-]?15|aerox|r3|mt[\s-]?03/i },
  { make: /bajaj/i, model: /ns\s?200|rs\s?200|ns\s?400|dominar/i },
  { make: /tvs/i, model: /r[rt]r?\s?310/i },
  { make: /royal enfield/i, model: /himalayan 450|guerrilla/i },
  { make: /triumph/i, model: /speed 400|scrambler 400/i },
  { make: /honda/i, model: /cbr|nx\s?500|cb\s?500|cb\s?650/i },
  { make: /suzuki/i, model: /v[\s-]?strom 800|gsx[\s-]?8/i },
  { make: /aprilia/i, model: /rs\s?457|tuono/i },
];

export function isScooter(facts: TwoWheelerFacts): boolean {
  return (
    Boolean(facts.bodyType && /scooter/i.test(facts.bodyType)) ||
    Boolean(facts.transmission && /\bcvt\b/i.test(facts.transmission)) ||
    SCOOTER_MODELS.test(facts.model)
  );
}

/** What the table knows for this two-wheeler; a field it can't vouch for is left out. */
export function curatedDriveCooling(facts: TwoWheelerFacts): DriveCooling {
  const result: DriveCooling = {};

  if (isScooter(facts)) {
    // A scooter's variator belt: never chain service.
    result.driveType = 'belt';
  } else {
    const exception = NOT_CHAIN.find(
      (rule) => rule.make.test(facts.make) && rule.model.test(facts.model),
    );
    result.driveType = exception?.driveType ?? 'chain';
  }

  if (LIQUID_COOLED.some((rule) => rule.make.test(facts.make) && rule.model.test(facts.model))) {
    result.coolingType = 'liquid-cooled';
  }

  return result;
}

/**
 * The fields to write: only those the spec row has no value for, so the
 * source's own figures always win and a rerun changes nothing.
 */
export function missingDriveCooling(
  current: { driveType: string | null; coolingType: string | null } | null,
  curated: DriveCooling,
): DriveCooling {
  const fill: DriveCooling = {};
  if (!current?.driveType && curated.driveType) fill.driveType = curated.driveType;
  if (!current?.coolingType && curated.coolingType) fill.coolingType = curated.coolingType;
  return fill;
}
