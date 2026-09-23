import type { VehicleCatalogVariantOption } from '@vehicle-vault/shared';

export type VariantYears = Pick<VehicleCatalogVariantOption, 'yearStart' | 'yearEnd'>;

/**
 * Whether the form's make, model and variant survive a change of year. They do
 * while the year is still being typed (the field passes through "2", "20",
 * "202"), and when the chosen variant was on sale in the new year; otherwise
 * the pickers start over, since they only list what was sold that year.
 */
export function keepsCatalogSelection(year: number, variantYears: VariantYears | null): boolean {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return true;
  }

  if (!variantYears) {
    return false;
  }

  return (
    (variantYears.yearStart === undefined || year >= variantYears.yearStart) &&
    (variantYears.yearEnd === undefined || year <= variantYears.yearEnd)
  );
}
