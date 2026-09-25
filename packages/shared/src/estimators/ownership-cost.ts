import { FuelType } from '../enums/fuel-type.enum';
import { VehicleType } from '../enums/vehicle-type.enum';

/**
 * Ownership-cost estimator: what a vehicle costs to run each month, each year
 * and over the years someone keeps it, split into energy and service. Given an
 * on-road price, it also works out the cost of owning it over those years: the
 * price, less an assumed resale value, plus the running cost. The running
 * cost never includes the purchase.
 *
 * A pure function over plain numbers. Anything the caller leaves `undefined`
 * is filled from the defaults below and named in `defaulted`, so a page can
 * say which figures are the visitor's and which are assumptions. Input it
 * cannot make sense of (missing, zero, negative, absurd, not a number) comes
 * back as a `cannot-estimate` result: it never throws, and every figure in an
 * estimate is a finite number.
 */

/**
 * When the default prices and costs below were last checked. They are rough
 * national figures, not any city's, and they go stale: update the numbers and
 * this date together.
 */
export const OWNERSHIP_COST_DEFAULTS_AS_OF = '2026-09';

/**
 * Typical Indian retail price per unit of energy, in rupees: per litre for
 * petrol, diesel and LPG, per kg for CNG, per kWh for electricity (a home
 * charging tariff; public fast chargers cost several times more). A hybrid
 * runs on petrol. `other` has no default, so its price must be entered.
 */
export const DEFAULT_ENERGY_PRICE_INR: Readonly<Partial<Record<FuelType, number>>> = {
  [FuelType.Petrol]: 103,
  [FuelType.Diesel]: 90,
  [FuelType.Hybrid]: 103,
  [FuelType.CNG]: 85,
  [FuelType.LPG]: 60,
  [FuelType.Electric]: 9,
};

/**
 * Typical cost, in rupees, of one periodic service at an authorised workshop:
 * labour, oil and filters, not repairs. Trucks and `other` have no default.
 */
export const DEFAULT_SERVICE_COST_PER_VISIT_INR: Readonly<Partial<Record<VehicleType, number>>> = {
  [VehicleType.Car]: 5000,
  [VehicleType.SUV]: 6500,
  [VehicleType.Van]: 5500,
  [VehicleType.Motorcycle]: 1500,
};

/** A typical monthly distance: a daily commute plus the odd trip. */
export const DEFAULT_KM_PER_MONTH: Readonly<Record<VehicleType, number>> = {
  [VehicleType.Car]: 1000,
  [VehicleType.SUV]: 1000,
  [VehicleType.Van]: 1000,
  [VehicleType.Motorcycle]: 800,
  [VehicleType.Truck]: 1000,
  [VehicleType.Other]: 1000,
};

export const DEFAULT_OWNERSHIP_YEARS = 5;

/**
 * Typical real-world efficiency by vehicle type and fuel, for a variant the
 * catalog has no claimed figure for: km/L (km/kg for CNG), or kWh per 100 km
 * for an EV. Rough national figures, dated with the prices above; a page says
 * they are typical, not the variant's own.
 */
export const TYPICAL_EFFICIENCY: Readonly<
  Partial<Record<VehicleType, Partial<Record<FuelType, number>>>>
> = {
  [VehicleType.Car]: {
    [FuelType.Petrol]: 15,
    [FuelType.Diesel]: 19,
    [FuelType.CNG]: 22,
    [FuelType.Hybrid]: 22,
    [FuelType.LPG]: 13,
    [FuelType.Electric]: 14,
  },
  [VehicleType.SUV]: {
    [FuelType.Petrol]: 12,
    [FuelType.Diesel]: 15,
    [FuelType.CNG]: 18,
    [FuelType.Hybrid]: 19,
    [FuelType.Electric]: 17,
  },
  [VehicleType.Van]: {
    [FuelType.Petrol]: 13,
    [FuelType.Diesel]: 16,
    [FuelType.CNG]: 20,
    [FuelType.Electric]: 18,
  },
  [VehicleType.Motorcycle]: {
    [FuelType.Petrol]: 45,
    [FuelType.Electric]: 3,
  },
};

/**
 * The share of its value a vehicle is assumed to keep each year, for the cost
 * of ownership: about 15% lost a year, so roughly 44% is left after five.
 * Real resale varies a lot by model and condition; a page says it is assumed.
 */
export const ASSUMED_VALUE_KEPT_PER_YEAR = 0.85;

/**
 * The accepted range of each input, inclusive. Anything outside it is treated
 * as a typo rather than estimated. The lower bounds are what keep every figure
 * finite: efficiency and years are divisors.
 */
export const OWNERSHIP_COST_LIMITS = {
  kmPerMonth: { min: 1, max: 20_000 },
  years: { min: 1, max: 30 },
  /** km per litre, or per kg of CNG. */
  liquidEfficiency: { min: 1, max: 200 },
  /** kWh per 100 km. */
  electricEfficiency: { min: 1, max: 100 },
  /** Zero is allowed: free charging at work, or a free first service. */
  energyPrice: { min: 0, max: 1_000 },
  serviceCostPerVisit: { min: 0, max: 200_000 },
  onRoadPrice: { min: 1, max: 100_000_000 },
  serviceIntervalKm: { min: 100, max: 1_000_000 },
  serviceIntervalMonths: { min: 1, max: 240 },
  /** Fractional so a two-year interval (0.5 a year) is still enterable. */
  servicesPerYear: { min: 0.1, max: 24 },
} as const;

/** How the vehicle turns money into distance. */
export type OwnershipCostEnergyKind = 'liquid' | 'electric';

export interface OwnershipCostEnergyUnits {
  kind: OwnershipCostEnergyKind;
  /** "km/L", "km/kg" (CNG) or "kWh/100 km". */
  efficiencyUnit: 'km/L' | 'km/kg' | 'kWh/100 km';
  /** What the price is per: "L", "kg" or "kWh". */
  priceUnit: 'L' | 'kg' | 'kWh';
}

export function ownershipCostEnergyUnits(fuelType: FuelType): OwnershipCostEnergyUnits {
  if (fuelType === FuelType.Electric) {
    return { kind: 'electric', efficiencyUnit: 'kWh/100 km', priceUnit: 'kWh' };
  }
  if (fuelType === FuelType.CNG) {
    return { kind: 'liquid', efficiencyUnit: 'km/kg', priceUnit: 'kg' };
  }
  return { kind: 'liquid', efficiencyUnit: 'km/L', priceUnit: 'L' };
}

/** The maker's figures an estimate can start from, as the catalog holds them. */
export interface OwnershipCostClaimedFigures {
  /** Claimed km/L, or km/kg for CNG. */
  mileage?: number | null;
  /** Claimed range on a full charge, for an EV. */
  rangeKm?: number | null;
  batteryKwh?: number | null;
}

/** The inputs a visitor can set. */
export type OwnershipCostVisitorField =
  | 'kmPerMonth'
  | 'years'
  | 'efficiency'
  | 'energyPrice'
  | 'serviceCostPerVisit'
  | 'servicesPerYear'
  | 'onRoadPrice';

/** Every input an estimate can be refused over. */
export type OwnershipCostField = OwnershipCostVisitorField | 'serviceInterval';

/** The inputs that have a default; the on-road price does not. */
export type OwnershipCostDefaultedField = Exclude<OwnershipCostVisitorField, 'onRoadPrice'>;

/**
 * For each visitor input: `undefined` means "not given, use the default",
 * `null` means "given as blank", and a number is validated as it is. A blank
 * on-road price just leaves the purchase out; any other blank field cannot be
 * estimated.
 */
export interface OwnershipCostInput {
  fuelType: FuelType;
  vehicleType: VehicleType;
  /** The maker's figures; the default efficiency comes from these. */
  claimed?: OwnershipCostClaimedFigures;
  /**
   * The periodic-service interval from the resolved schedule, whichever of km
   * and months comes first. Null when the schedule has none.
   */
  serviceInterval: { km: number | null; months: number | null } | null;
  kmPerMonth?: number | null;
  years?: number | null;
  /** km/L (km/kg for CNG) for a liquid fuel, kWh per 100 km for an EV. */
  efficiency?: number | null;
  /** Rupees per litre, kg or kWh. */
  energyPrice?: number | null;
  serviceCostPerVisit?: number | null;
  /**
   * How many periodic services a year the visitor expects, overriding the
   * count `serviceInterval` would otherwise imply. Left alone, it defaults to
   * that implied count at a typical distance for the vehicle type — not to
   * whatever `kmPerMonth` is given, so it reads the same whether or not the
   * visitor has touched other fields.
   */
  servicesPerYear?: number | null;
  onRoadPrice?: number | null;
}

/** The value each defaulted input takes; null when there is no default for this vehicle. */
export type OwnershipCostDefaults = Record<OwnershipCostDefaultedField, number | null>;

/** The running cost for one period, in rupees: energy and service, never the purchase. */
export interface OwnershipCostBreakdown {
  energy: number;
  service: number;
  total: number;
}

/**
 * The cost of owning it over `inputs.years`, in rupees, when an on-road price
 * was given: the price, less what it might sell for at the end, plus running
 * it for those years.
 */
export interface OwnershipCostOwnership {
  onRoadPrice: number;
  /** Assumed, from `ASSUMED_VALUE_KEPT_PER_YEAR`. */
  resaleValue: number;
  running: number;
  total: number;
  perMonth: number;
}

/** Where a defaulted efficiency came from: the maker's claim, or a typical figure for the type and fuel. */
export type OwnershipCostEfficiencySource = 'claimed' | 'typical';

export interface OwnershipCostEstimate {
  kind: 'estimate';
  units: OwnershipCostEnergyUnits;
  /** The figures the estimate was worked out from, given or defaulted. */
  inputs: {
    kmPerMonth: number;
    years: number;
    efficiency: number;
    energyPrice: number;
    serviceCostPerVisit: number;
    servicesPerYear: number;
    onRoadPrice: number | null;
    serviceInterval: { km: number | null; months: number | null };
  };
  /** Inputs the caller did not give, filled from the claimed figures or the defaults. */
  defaulted: OwnershipCostDefaultedField[];
  /** Average periodic services a year; fractional, since visits fall where they fall. */
  serviceVisitsPerYear: number;
  /** Where the efficiency came from when the visitor left it alone; null when they gave one. */
  efficiencySource: OwnershipCostEfficiencySource | null;
  perMonth: OwnershipCostBreakdown;
  perYear: OwnershipCostBreakdown;
  overYears: OwnershipCostBreakdown;
  /** Null when no on-road price was given. */
  ownership: OwnershipCostOwnership | null;
}

export type OwnershipCostProblemKind = 'missing' | 'not-a-number' | 'too-small' | 'too-large';

export interface OwnershipCostProblem {
  field: OwnershipCostField;
  problem: OwnershipCostProblemKind;
}

export interface OwnershipCostCannotEstimate {
  kind: 'cannot-estimate';
  /** One entry per input at fault, in input order. Never empty. */
  problems: OwnershipCostProblem[];
}

export type OwnershipCostResult = OwnershipCostEstimate | OwnershipCostCannotEstimate;

/**
 * The maker's efficiency in the estimator's unit: claimed km/L (km/kg) for a
 * liquid fuel; for an EV, the battery divided by the claimed range, in kWh per
 * 100 km and rounded to one decimal. Null when the catalog has no usable
 * figure. Claimed figures are measured on a test cycle and flatter real use.
 */
export function claimedEfficiency(
  fuelType: FuelType,
  claimed: OwnershipCostClaimedFigures | undefined,
): number | null {
  if (!claimed) return null;
  if (ownershipCostEnergyUnits(fuelType).kind === 'electric') {
    const { batteryKwh, rangeKm } = claimed;
    if (!isPositive(batteryKwh) || !isPositive(rangeKm)) return null;
    const perHundredKm = Math.round((batteryKwh / rangeKm) * 1000) / 10;
    return isPositive(perHundredKm) ? perHundredKm : null;
  }
  return isPositive(claimed.mileage) ? claimed.mileage : null;
}

/** The efficiency a visitor starts from: the maker's claim, else a typical figure; null when neither exists. */
export function defaultEfficiency(
  input: Pick<OwnershipCostInput, 'fuelType' | 'vehicleType' | 'claimed'>,
): { value: number; source: OwnershipCostEfficiencySource } | null {
  const claimed = claimedEfficiency(input.fuelType, input.claimed);
  if (claimed !== null) return { value: claimed, source: 'claimed' };
  const typical = TYPICAL_EFFICIENCY[input.vehicleType]?.[input.fuelType];
  return typical === undefined ? null : { value: typical, source: 'typical' };
}

/** What each input falls back to for this vehicle when the visitor leaves it alone. */
export function ownershipCostDefaults(
  input: Pick<OwnershipCostInput, 'fuelType' | 'vehicleType' | 'claimed'> & {
    serviceInterval?: OwnershipCostInput['serviceInterval'];
  },
): OwnershipCostDefaults {
  return {
    kmPerMonth: DEFAULT_KM_PER_MONTH[input.vehicleType] ?? null,
    years: DEFAULT_OWNERSHIP_YEARS,
    efficiency: defaultEfficiency(input)?.value ?? null,
    energyPrice: DEFAULT_ENERGY_PRICE_INR[input.fuelType] ?? null,
    serviceCostPerVisit: DEFAULT_SERVICE_COST_PER_VISIT_INR[input.vehicleType] ?? null,
    servicesPerYear: defaultServicesPerYear(input.vehicleType, input.serviceInterval ?? null),
  };
}

/**
 * How many services a year `serviceInterval` implies, at a typical monthly
 * distance for the vehicle type — not the visitor's own distance, so this
 * reads the same regardless of what else they've entered, like every other
 * assumed figure. Null when there's no interval to work from.
 */
function defaultServicesPerYear(
  vehicleType: VehicleType,
  serviceInterval: OwnershipCostInput['serviceInterval'] | undefined,
): number | null {
  if (!serviceInterval) return null;
  const { km, months } = serviceInterval;
  const typicalKmPerMonth = DEFAULT_KM_PER_MONTH[vehicleType] ?? null;
  const visitsByDistance = km && typicalKmPerMonth ? (typicalKmPerMonth * 12) / km : 0;
  const visitsByTime = months ? 12 / months : 0;
  const visits = Math.max(visitsByDistance, visitsByTime);
  return visits > 0 ? Math.round(visits * 100) / 100 : null;
}

export function estimateOwnershipCost(input: OwnershipCostInput): OwnershipCostResult {
  const units = ownershipCostEnergyUnits(input.fuelType);
  const defaults = ownershipCostDefaults(input);
  const defaulted: OwnershipCostDefaultedField[] = [];
  const problems: OwnershipCostProblem[] = [];

  function take(
    field: OwnershipCostDefaultedField,
    given: number | null | undefined,
    limits: { min: number; max: number },
  ): number {
    let value = given;
    if (value === undefined) {
      value = defaults[field];
      if (value !== null) defaulted.push(field);
    }
    return check(field, value, limits, problems) ?? 0;
  }

  const kmPerMonth = take('kmPerMonth', input.kmPerMonth, OWNERSHIP_COST_LIMITS.kmPerMonth);
  const years = take('years', input.years, OWNERSHIP_COST_LIMITS.years);
  const efficiency = take(
    'efficiency',
    input.efficiency,
    units.kind === 'electric'
      ? OWNERSHIP_COST_LIMITS.electricEfficiency
      : OWNERSHIP_COST_LIMITS.liquidEfficiency,
  );
  const energyPrice = take('energyPrice', input.energyPrice, OWNERSHIP_COST_LIMITS.energyPrice);
  const serviceCostPerVisit = take(
    'serviceCostPerVisit',
    input.serviceCostPerVisit,
    OWNERSHIP_COST_LIMITS.serviceCostPerVisit,
  );

  // Not run through `take()`: its default isn't in `defaults` to be range-
  // checked against (a malformed serviceInterval already reports its own
  // problem below), only a visitor-given figure is. Left alone, it falls
  // back to what the interval implies at a typical distance.
  let serviceVisitsPerYear: number;
  if (input.servicesPerYear !== undefined) {
    const checked = check(
      'servicesPerYear',
      input.servicesPerYear,
      OWNERSHIP_COST_LIMITS.servicesPerYear,
      problems,
    );
    serviceVisitsPerYear = checked ?? 0;
  } else {
    const defaultVisits = defaults.servicesPerYear;
    if (defaultVisits !== null) defaulted.push('servicesPerYear');
    serviceVisitsPerYear = defaultVisits ?? 0;
  }

  // A blank or absent on-road price leaves ownership out; a given one must make sense.
  const onRoadPrice =
    input.onRoadPrice === undefined || input.onRoadPrice === null
      ? null
      : check('onRoadPrice', input.onRoadPrice, OWNERSHIP_COST_LIMITS.onRoadPrice, problems);

  const serviceInterval = checkServiceInterval(input.serviceInterval, problems);

  if (problems.length > 0 || !serviceInterval) {
    return { kind: 'cannot-estimate', problems };
  }

  const energyPerMonth =
    units.kind === 'electric'
      ? ((kmPerMonth * efficiency) / 100) * energyPrice
      : (kmPerMonth / efficiency) * energyPrice;

  const servicePerYear = serviceVisitsPerYear * serviceCostPerVisit;

  const months = years * 12;
  const overYears = breakdown(energyPerMonth * months, servicePerYear * years);

  return {
    kind: 'estimate',
    units,
    inputs: {
      kmPerMonth,
      years,
      efficiency,
      energyPrice,
      serviceCostPerVisit,
      servicesPerYear: serviceVisitsPerYear,
      onRoadPrice,
      serviceInterval,
    },
    defaulted,
    serviceVisitsPerYear,
    efficiencySource: defaulted.includes('efficiency')
      ? (defaultEfficiency(input)?.source ?? null)
      : null,
    perMonth: breakdown(energyPerMonth, servicePerYear / 12),
    perYear: breakdown(energyPerMonth * 12, servicePerYear),
    overYears,
    ownership: onRoadPrice === null ? null : ownership(onRoadPrice, years, overYears.total),
  };
}

function breakdown(energy: number, service: number): OwnershipCostBreakdown {
  return { energy, service, total: energy + service };
}

function ownership(onRoadPrice: number, years: number, running: number): OwnershipCostOwnership {
  const resaleValue = onRoadPrice * ASSUMED_VALUE_KEPT_PER_YEAR ** years;
  const total = onRoadPrice - resaleValue + running;
  return { onRoadPrice, resaleValue, running, total, perMonth: total / (years * 12) };
}

function check(
  field: OwnershipCostField,
  value: number | null,
  limits: { min: number; max: number },
  problems: OwnershipCostProblem[],
): number | null {
  const problem = problemWith(value, limits);
  if (problem) {
    problems.push({ field, problem });
    return null;
  }
  return value;
}

function problemWith(
  value: number | null,
  limits: { min: number; max: number },
): OwnershipCostProblemKind | null {
  if (value === null) return 'missing';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not-a-number';
  if (value < limits.min) return 'too-small';
  if (value > limits.max) return 'too-large';
  return null;
}

/** At least one of km and months, each within its range; null (and a problem) otherwise. */
function checkServiceInterval(
  interval: OwnershipCostInput['serviceInterval'],
  problems: OwnershipCostProblem[],
): { km: number | null; months: number | null } | null {
  const km = interval?.km ?? null;
  const months = interval?.months ?? null;
  if (km === null && months === null) {
    problems.push({ field: 'serviceInterval', problem: 'missing' });
    return null;
  }
  const problem =
    (km === null ? null : problemWith(km, OWNERSHIP_COST_LIMITS.serviceIntervalKm)) ??
    (months === null ? null : problemWith(months, OWNERSHIP_COST_LIMITS.serviceIntervalMonths));
  if (problem) {
    problems.push({ field: 'serviceInterval', problem });
    return null;
  }
  return { km, months };
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
