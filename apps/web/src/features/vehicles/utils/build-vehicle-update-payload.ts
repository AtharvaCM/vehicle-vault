import type { FieldNamesMarkedBoolean } from 'react-hook-form';

import type { VehicleFormValues } from '../schemas/vehicle-form.schema';

/**
 * Fields that resolve `catalogVariantId`. It isn't a form field react-hook-form
 * tracks as dirty on its own (it is derived from the catalog match at submit
 * time), and the API only re-resolves it on its own when make, model, year,
 * vehicle type or fuel type change — never for a variant-only edit. So it
 * travels with any of them, or a variant switch silently keeps pointing at the
 * old catalog entry.
 */
const CATALOG_LINKED_FIELDS: Array<keyof VehicleFormValues> = [
  'make',
  'model',
  'variant',
  'year',
  'vehicleType',
  'fuelType',
];

/**
 * Trims a fully-validated vehicle form submission down to what an edit should
 * send: only the fields the owner actually changed, plus the catalog link
 * when one of the fields it depends on changed. Editing a vehicle sends this;
 * adding one still sends the full object, since there is nothing yet to diff
 * against.
 */
export function buildVehicleUpdatePayload(
  values: VehicleFormValues,
  dirtyFields: Partial<Readonly<FieldNamesMarkedBoolean<VehicleFormValues>>>,
): Partial<VehicleFormValues> {
  const payload: Partial<VehicleFormValues> = {};
  // Widened for the assignment below: TypeScript can't correlate an arbitrary
  // `keyof VehicleFormValues` with the matching value type on both sides at
  // once, even though every key here does come from `values` itself.
  const target = payload as Record<string, unknown>;

  for (const key of Object.keys(dirtyFields) as Array<keyof VehicleFormValues>) {
    if (dirtyFields[key]) {
      target[key] = values[key];
    }
  }

  const catalogLinkedFieldChanged = CATALOG_LINKED_FIELDS.some((field) => dirtyFields[field]);

  if (catalogLinkedFieldChanged) {
    payload.catalogVariantId = values.catalogVariantId;
  }

  return payload;
}
