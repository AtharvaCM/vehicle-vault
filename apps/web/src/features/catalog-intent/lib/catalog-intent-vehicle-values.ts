import type {
  CreateVehicleInput,
  PublicCatalogOffering,
  PublicCatalogVariantPage,
} from '@vehicle-vault/shared';

export type CatalogIntentVehicleValues = Pick<
  CreateVehicleInput,
  'vehicleType' | 'year' | 'make' | 'model' | 'variant' | 'fuelType'
>;

/**
 * The add-vehicle form's starting values for a catalog variant. Make, model and
 * variant are the catalog's names, which is what the form's pickers hold, and
 * the year is one the variant was sold in: the pickers only list what was on
 * sale in the chosen year, so any other year would leave the variant unmatched.
 */
export function catalogIntentVehicleValues(
  page: PublicCatalogVariantPage,
  now: Date = new Date(),
): CatalogIntentVehicleValues {
  return {
    vehicleType: page.vehicleType,
    year: latestYearOnSale(page.offerings, now.getFullYear()),
    make: page.make.name,
    model: page.model.name,
    variant: page.variant.name,
    fuelType: page.calculatorSeed.fuelType,
  };
}

/**
 * This year for a variant still on sale, otherwise the last year it was sold.
 * `offerings` comes newest first, as the public payload sends it.
 */
export function latestYearOnSale(offerings: PublicCatalogOffering[], currentYear: number): number {
  const newest = offerings[0];

  if (!newest) {
    return currentYear;
  }

  const year = Math.min(currentYear, newest.yearEnd ?? currentYear);

  // Announced but not yet on sale: its first year is the only one that matches.
  return newest.yearStart !== null && year < newest.yearStart ? newest.yearStart : year;
}
