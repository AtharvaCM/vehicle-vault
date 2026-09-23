import {
  FuelType,
  MaintenanceCategory,
  ReminderType,
  TYRE_INSPECTION_INTERVAL_KM,
  TYRE_INSPECTION_INTERVAL_MONTHS,
  VehicleType,
} from '@vehicle-vault/shared';

/**
 * The slug of the tyre walk-around item, named here because the alert engine
 * matches on it (see `isAlertedFromMeasurements`). This module imports nothing
 * from the reminders service, so the notifications module can read it without
 * a dependency cycle (reminders → notifications → tyres).
 */
export const TYRE_INSPECTION_SLUG = 'tyre_inspection';

/**
 * Static catalog of generic recommended service intervals. Not bound to a
 * specific make/model — those would need a per-OEM dataset we don't have
 * yet. Each entry knows which `FuelType` / `VehicleType` it applies to so
 * EV owners don't get oil-change suggestions and motorcycle owners don't
 * get cabin-air-filter ones.
 *
 * Intervals are conservative defaults. Users can edit the resulting
 * reminder before / after applying it.
 */
export interface ServiceScheduleItem {
  /** Stable slug used by the apply endpoint. */
  slug: string;
  type: ReminderType;
  title: string;
  notes?: string;
  intervalKm?: number;
  intervalMonths?: number;
  appliesToFuel?: FuelType[];
  appliesToVehicle?: VehicleType[];
  /**
   * MaintenanceCategory this item corresponds to, when one exists. Lets
   * MaintenanceIntervalResolver override the generic interval with
   * per-variant catalog data for linked vehicles.
   */
  category?: MaintenanceCategory;
}

const ALL_NON_ELECTRIC: FuelType[] = [
  FuelType.Petrol,
  FuelType.Diesel,
  FuelType.CNG,
  FuelType.LPG,
  FuelType.Hybrid,
];

export const SERVICE_SCHEDULE_CATALOG: ServiceScheduleItem[] = [
  {
    slug: 'engine_oil_change',
    category: MaintenanceCategory.EngineOil,
    type: ReminderType.Service,
    title: 'Engine oil change',
    intervalKm: 10000,
    intervalMonths: 12,
    appliesToFuel: ALL_NON_ELECTRIC,
    notes: 'Whichever of the distance or the time comes first.',
  },
  {
    slug: 'tyre_rotation',
    category: MaintenanceCategory.TyreRotation,
    type: ReminderType.TyreRotation,
    title: 'Tyre rotation',
    intervalKm: 10000,
    notes: 'Even tread wear extends tyre life.',
  },
  {
    /**
     * Deliberately separate from `tyre_rotation`. A rotation is work done to the
     * tyres; this is a measurement of them, and it is the only catalog item
     * whose whole point is to produce a reading rather than a repair. Tread is
     * unknowable between measurements, so the cadence is what turns "I happened
     * to look today" into something the app can ask for.
     */
    slug: TYRE_INSPECTION_SLUG,
    type: ReminderType.Inspection,
    title: 'Tyre tread & pressure check',
    intervalKm: TYRE_INSPECTION_INTERVAL_KM,
    intervalMonths: TYRE_INSPECTION_INTERVAL_MONTHS,
    notes: 'Measure tread depth at each corner and check pressures, then log the readings.',
  },
  {
    slug: 'brake_inspection',
    category: MaintenanceCategory.BrakePads,
    type: ReminderType.Service,
    title: 'Brake pad inspection',
    intervalKm: 20000,
    intervalMonths: 24,
    notes: 'Replace pads if thickness is below 3 mm.',
  },
  {
    slug: 'coolant_flush',
    category: MaintenanceCategory.Coolant,
    type: ReminderType.Service,
    title: 'Coolant flush',
    intervalKm: 40000,
    intervalMonths: 24,
    appliesToFuel: ALL_NON_ELECTRIC,
  },
  {
    slug: 'air_filter',
    category: MaintenanceCategory.AirFilter,
    type: ReminderType.Service,
    title: 'Air filter replacement',
    intervalKm: 20000,
    intervalMonths: 24,
    appliesToFuel: ALL_NON_ELECTRIC,
  },
  {
    slug: 'battery_check',
    type: ReminderType.Battery,
    title: '12 V battery health check',
    intervalMonths: 24,
  },
  {
    slug: 'ev_battery_health',
    type: ReminderType.Battery,
    title: 'High-voltage battery health check',
    intervalMonths: 12,
    appliesToFuel: [FuelType.Electric, FuelType.Hybrid],
    notes: 'Confirm pack capacity and cell balance with dealer diagnostics.',
  },
  {
    slug: 'puc_renewal',
    type: ReminderType.Puc,
    title: 'PUC certificate renewal',
    intervalMonths: 6,
    appliesToFuel: [FuelType.Petrol, FuelType.Diesel, FuelType.CNG, FuelType.LPG, FuelType.Hybrid],
  },
  {
    slug: 'insurance_renewal',
    type: ReminderType.Insurance,
    title: 'Insurance renewal',
    intervalMonths: 12,
  },
  {
    slug: 'chain_lube',
    category: MaintenanceCategory.ChainService,
    type: ReminderType.Service,
    title: 'Chain clean & lube',
    intervalKm: 500,
    appliesToVehicle: [VehicleType.Motorcycle],
    notes: 'Motorcycle drive chains need frequent maintenance.',
  },
];

export function filterCatalogForVehicle(
  fuelType: FuelType,
  vehicleType: VehicleType,
): ServiceScheduleItem[] {
  return SERVICE_SCHEDULE_CATALOG.filter((item) => {
    if (item.appliesToFuel && !item.appliesToFuel.includes(fuelType)) return false;
    if (item.appliesToVehicle && !item.appliesToVehicle.includes(vehicleType)) return false;
    return true;
  });
}
