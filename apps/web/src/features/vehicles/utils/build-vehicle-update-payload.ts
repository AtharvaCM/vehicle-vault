import type { FieldNamesMarkedBoolean } from 'react-hook-form';

import type { VehicleFormValues } from '../schemas/vehicle-form.schema';
import type { UpdateVehicleInput } from '../types/vehicle';

/**
 * Fields that resolve `catalogVariantId`. It isn't a form field react-hook-form
 * tracks as dirty on its own (it is derived from the catalog match at submit
 * time). It travels with any of them: a catalog option picked in the form
 * carries its id, and a variant typed by hand or cleared carries none, which
 * tells the API to re-resolve the link from the vehicle's other fields.
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
 * Optional text fields the form resolves to `undefined` when left blank. On an
 * edit, a dirty one that is blank was cleared on purpose and must go as `null`:
 * `undefined` drops out of the JSON body, and the API keeps the old value.
 */
const CLEARABLE_TEXT_FIELDS = ['nickname', 'variant'] as const;

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
): UpdateVehicleInput {
  const payload: UpdateVehicleInput = {};
  // Widened for the assignment below: TypeScript can't correlate an arbitrary
  // `keyof VehicleFormValues` with the matching value type on both sides at
  // once, even though every key here does come from `values` itself.
  const target = payload as Record<string, unknown>;

  for (const key of Object.keys(dirtyFields) as Array<keyof VehicleFormValues>) {
    if (dirtyFields[key]) {
      target[key] = values[key];
    }
  }

  for (const field of CLEARABLE_TEXT_FIELDS) {
    if (dirtyFields[field] && values[field] === undefined) {
      payload[field] = null;
    }
  }

  const catalogLinkedFieldChanged = CATALOG_LINKED_FIELDS.some((field) => dirtyFields[field]);

  if (catalogLinkedFieldChanged) {
    payload.catalogVariantId = values.catalogVariantId;
  }

  return payload;
}
