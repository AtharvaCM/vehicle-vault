/** The unit a vehicle's economy is measured in, which follows what it runs on. */
export type FuelEconomyUnit = 'km/L' | 'km/kg' | 'km/kWh';

/**
 * What a vehicle actually returns, measured fill to fill from its own fuel
 * logs, next to what its catalog variant claims.
 */
export type VehicleFuelEconomy = {
  unit: FuelEconomyUnit;
  /** Fills with a quantity and a rising odometer; two are needed for a figure. */
  usableFills: number;
  /** Null until there are two usable fills. */
  achieved: {
    value: number;
    distanceKm: number;
    quantity: number;
  } | null;
  /** The catalog's combined figure in the same unit, when the vehicle is linked to one. */
  claimed: number | null;
  /** How far achieved sits from claimed, in percent; negative is below the claim. */
  differencePercent: number | null;
};
