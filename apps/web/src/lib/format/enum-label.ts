import {
  AttachmentExtractionStatus,
  AttachmentKind,
  FuelType,
  LoanStatus,
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
  ReminderStatus,
  ReminderType,
  ServiceBaselineStatus,
  TyrePosition,
  VehicleCatalogMarket,
  VehicleRole,
  VehicleType,
  type TyreConditionLevel,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { EMPTY } from './empty';

/*
 * One human label per value of every shared enum, in sentence case. Each map
 * `satisfies` a `Record` over its enum, so adding a value to the enum fails the
 * web typecheck until it has a label here.
 */

const attachmentExtractionStatus = {
  [AttachmentExtractionStatus.Pending]: 'Reading',
  [AttachmentExtractionStatus.Completed]: 'Read',
  [AttachmentExtractionStatus.Failed]: 'Could not read',
} satisfies Record<AttachmentExtractionStatus, string>;

const attachmentKind = {
  [AttachmentKind.Receipt]: 'Receipt',
  [AttachmentKind.Document]: 'Document',
  [AttachmentKind.Image]: 'Photo',
  [AttachmentKind.Other]: 'Other',
} satisfies Record<AttachmentKind, string>;

const documentKind = {
  insurance: 'Insurance',
  puc: 'PUC',
  registration: 'RC',
  road_tax: 'Road tax',
  warranty: 'Warranty',
} satisfies Record<VehicleDocumentKind, string>;

const fuelType = {
  [FuelType.Petrol]: 'Petrol',
  [FuelType.Diesel]: 'Diesel',
  [FuelType.Electric]: 'Electric',
  [FuelType.Hybrid]: 'Hybrid',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.Other]: 'Other',
} satisfies Record<FuelType, string>;

const loanStatus = {
  [LoanStatus.Active]: 'Active',
  [LoanStatus.Closed]: 'Closed',
} satisfies Record<LoanStatus, string>;

const maintenanceCategory = {
  [MaintenanceCategory.PeriodicService]: 'Periodic service',
  [MaintenanceCategory.EngineOil]: 'Engine oil',
  [MaintenanceCategory.OilFilter]: 'Oil filter',
  [MaintenanceCategory.AirFilter]: 'Air filter',
  [MaintenanceCategory.BrakePads]: 'Brake pads',
  [MaintenanceCategory.TyreRotation]: 'Tyre rotation',
  [MaintenanceCategory.WheelAlignment]: 'Wheel alignment',
  [MaintenanceCategory.Battery]: 'Battery',
  [MaintenanceCategory.Coolant]: 'Coolant',
  [MaintenanceCategory.Clutch]: 'Clutch',
  [MaintenanceCategory.ChainService]: 'Chain service',
  [MaintenanceCategory.TimingBelt]: 'Timing belt',
  [MaintenanceCategory.TyreReplacement]: 'Tyre replacement',
  [MaintenanceCategory.Puncture]: 'Puncture',
  [MaintenanceCategory.Insurance]: 'Insurance',
  [MaintenanceCategory.Puc]: 'PUC',
  [MaintenanceCategory.BodyTrim]: 'Body trim',
  [MaintenanceCategory.Lighting]: 'Lighting',
  [MaintenanceCategory.ElectricalRepair]: 'Electrical repair',
  [MaintenanceCategory.Fasteners]: 'Fasteners',
  [MaintenanceCategory.Detailing]: 'Detailing',
  [MaintenanceCategory.BrakeService]: 'Brake service',
  [MaintenanceCategory.SparkPlug]: 'Spark plug',
  [MaintenanceCategory.CvtBelt]: 'CVT belt',
  [MaintenanceCategory.Other]: 'Other',
} satisfies Record<MaintenanceCategory, string>;

const maintenanceLineItemKind = {
  [MaintenanceLineItemKind.Job]: 'Job',
  [MaintenanceLineItemKind.Part]: 'Part',
  [MaintenanceLineItemKind.Fluid]: 'Fluid',
  [MaintenanceLineItemKind.Labor]: 'Labour',
  [MaintenanceLineItemKind.Fee]: 'Fee',
  [MaintenanceLineItemKind.Tax]: 'Tax',
  [MaintenanceLineItemKind.Discount]: 'Discount',
  [MaintenanceLineItemKind.Other]: 'Other',
} satisfies Record<MaintenanceLineItemKind, string>;

const maintenanceRecordStatus = {
  [MaintenanceRecordStatus.Draft]: 'Draft',
  [MaintenanceRecordStatus.Confirmed]: 'Saved',
} satisfies Record<MaintenanceRecordStatus, string>;

const maintenanceSource = {
  [MaintenanceSource.Manual]: 'Entered by hand',
  [MaintenanceSource.Ocr]: 'Read from a bill',
  [MaintenanceSource.Csv]: 'Imported',
  [MaintenanceSource.Api]: 'Added by an app',
} satisfies Record<MaintenanceSource, string>;

const reminderStatus = {
  [ReminderStatus.Upcoming]: 'Upcoming',
  [ReminderStatus.DueToday]: 'Due today',
  [ReminderStatus.Overdue]: 'Overdue',
  [ReminderStatus.Completed]: 'Completed',
} satisfies Record<ReminderStatus, string>;

const reminderType = {
  [ReminderType.Service]: 'Service',
  [ReminderType.Insurance]: 'Insurance',
  [ReminderType.Puc]: 'PUC',
  [ReminderType.TyreRotation]: 'Tyre rotation',
  [ReminderType.Battery]: 'Battery',
  [ReminderType.Tax]: 'Road tax',
  [ReminderType.Inspection]: 'Inspection',
  [ReminderType.Emission]: 'Emission test',
  [ReminderType.Custom]: 'Custom',
} satisfies Record<ReminderType, string>;

const serviceBaselineStatus = {
  [ServiceBaselineStatus.Known]: 'Known',
  [ServiceBaselineStatus.Unknown]: 'Not known',
} satisfies Record<ServiceBaselineStatus, string>;

const tyreCondition = {
  illegal: 'Not roadworthy',
  replace: 'Replace',
  warn: 'Wearing',
  healthy: 'Healthy',
  unknown: 'Not measured',
} satisfies Record<TyreConditionLevel, string>;

const tyrePosition = {
  [TyrePosition.FrontLeft]: 'Front left',
  [TyrePosition.FrontRight]: 'Front right',
  [TyrePosition.RearLeft]: 'Rear left',
  [TyrePosition.RearRight]: 'Rear right',
  [TyrePosition.Spare]: 'Spare',
  [TyrePosition.Front]: 'Front',
  [TyrePosition.Rear]: 'Rear',
} satisfies Record<TyrePosition, string>;

const vehicleCatalogMarket = {
  [VehicleCatalogMarket.India]: 'India',
} satisfies Record<VehicleCatalogMarket, string>;

const vehicleRole = {
  [VehicleRole.Owner]: 'Owner',
  [VehicleRole.Editor]: 'Editor',
  [VehicleRole.Viewer]: 'Viewer',
} satisfies Record<VehicleRole, string>;

const vehicleType = {
  [VehicleType.Car]: 'Car',
  [VehicleType.Motorcycle]: 'Motorcycle',
  [VehicleType.SUV]: 'SUV',
  [VehicleType.Truck]: 'Truck',
  [VehicleType.Van]: 'Van',
  [VehicleType.Other]: 'Other',
} satisfies Record<VehicleType, string>;

const ENUM_LABELS = {
  attachmentExtractionStatus,
  attachmentKind,
  documentKind,
  fuelType,
  loanStatus,
  maintenanceCategory,
  maintenanceLineItemKind,
  maintenanceRecordStatus,
  maintenanceSource,
  reminderStatus,
  reminderType,
  serviceBaselineStatus,
  tyreCondition,
  tyrePosition,
  vehicleCatalogMarket,
  vehicleRole,
  vehicleType,
};

export type EnumKind = keyof typeof ENUM_LABELS;
export type EnumValue<K extends EnumKind> = keyof (typeof ENUM_LABELS)[K];

/** "engine_oil" → "Engine oil": a value the web does not know yet still reads as words. */
function humanise(value: string) {
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The label for a shared enum value: `enumLabel('fuelType', 'cng')` → "CNG".
 *
 * Takes any string as well, because many API payload types widen enums to
 * `string`; a value with no label (an API newer than this build) is humanised
 * rather than shown raw.
 */
export function enumLabel<K extends EnumKind>(
  kind: K,
  value: EnumValue<K> | (string & {}) | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return EMPTY;

  const labels: Record<string, string> = ENUM_LABELS[kind];

  return labels[value as string] ?? humanise(value as string);
}

/** Every value of one enum with its label, in declaration order: for selects and filters. */
export function enumOptions<K extends EnumKind>(kind: K) {
  return Object.entries(ENUM_LABELS[kind]).map(([value, label]) => ({
    value: value as EnumValue<K> & string,
    label: label as string,
  }));
}
