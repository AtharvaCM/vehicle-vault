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
  VehicleDocumentKindSchema,
  VehicleRole,
  VehicleType,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { enumLabel, enumOptions, type EnumKind } from './enum-label';

const SHARED_ENUMS: Record<EnumKind, readonly string[]> = {
  attachmentExtractionStatus: Object.values(AttachmentExtractionStatus),
  attachmentKind: Object.values(AttachmentKind),
  documentKind: VehicleDocumentKindSchema.options,
  fuelType: Object.values(FuelType),
  loanStatus: Object.values(LoanStatus),
  maintenanceCategory: Object.values(MaintenanceCategory),
  maintenanceLineItemKind: Object.values(MaintenanceLineItemKind),
  maintenanceRecordStatus: Object.values(MaintenanceRecordStatus),
  maintenanceSource: Object.values(MaintenanceSource),
  reminderStatus: Object.values(ReminderStatus),
  reminderType: Object.values(ReminderType),
  serviceBaselineStatus: Object.values(ServiceBaselineStatus),
  tyreCondition: ['illegal', 'replace', 'warn', 'healthy', 'unknown'],
  tyrePosition: Object.values(TyrePosition),
  vehicleCatalogMarket: Object.values(VehicleCatalogMarket),
  vehicleRole: Object.values(VehicleRole),
  vehicleType: Object.values(VehicleType),
};

describe('enumLabel', () => {
  it.each(Object.entries(SHARED_ENUMS))(
    'gives every %s value a sentence-case label that is not the raw value',
    (kind, values) => {
      for (const value of values) {
        const label = enumLabel(kind as EnumKind, value);

        expect(label).not.toContain('_');
        expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
        if (!/^[A-Z]{2,}$/.test(value)) expect(label).not.toBe(value);
      }
    },
  );

  it('keeps acronyms in capitals', () => {
    expect(enumLabel('fuelType', FuelType.CNG)).toBe('CNG');
    expect(enumLabel('vehicleType', VehicleType.SUV)).toBe('SUV');
    expect(enumLabel('maintenanceCategory', MaintenanceCategory.CvtBelt)).toBe('CVT belt');
    expect(enumLabel('reminderType', ReminderType.Puc)).toBe('PUC');
  });

  it('names a motorcycle rather than abbreviating it', () => {
    expect(enumLabel('vehicleType', VehicleType.Motorcycle)).toBe('Motorcycle');
  });

  it('humanises a value this build has no label for', () => {
    expect(enumLabel('maintenanceCategory', 'gearbox_oil')).toBe('Gearbox oil');
  });

  it('shows the empty state for no value', () => {
    expect(enumLabel('fuelType', null)).toBe('—');
    expect(enumLabel('fuelType', undefined)).toBe('—');
    expect(enumLabel('fuelType', '')).toBe('—');
  });
});

describe('enumOptions', () => {
  it('lists every value with its label, in enum order', () => {
    expect(enumOptions('fuelType').map((option) => option.value)).toEqual(Object.values(FuelType));
    expect(enumOptions('vehicleType')[1]).toEqual({ value: 'motorcycle', label: 'Motorcycle' });
  });
});
