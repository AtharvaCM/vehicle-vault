import {
  FuelType,
  VehicleType,
  type PublicCatalogMakeModel,
  type PublicCatalogModelPage,
  type PublicCatalogModelVariant,
  type PublicCatalogOffering,
  type PublicCatalogSchedule,
  type PublicCatalogScheduleItem,
} from '@vehicle-vault/shared';

const FUEL_LABELS: Record<FuelType, string> = {
  [FuelType.Petrol]: 'Petrol',
  [FuelType.Diesel]: 'Diesel',
  [FuelType.Electric]: 'Electric',
  [FuelType.Hybrid]: 'Hybrid',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.Other]: 'Other',
};

const VEHICLE_TYPE_NOUNS: Record<VehicleType, string> = {
  [VehicleType.Car]: 'car',
  [VehicleType.SUV]: 'SUV',
  [VehicleType.Van]: 'van',
  [VehicleType.Motorcycle]: 'motorcycle',
  [VehicleType.Truck]: 'truck',
  [VehicleType.Other]: 'vehicle',
};

export function formatFuelType(fuelType: FuelType) {
  return FUEL_LABELS[fuelType] ?? fuelType;
}

export function formatFuelTypes(fuelTypes: FuelType[]) {
  return fuelTypes.map(formatFuelType).join(', ');
}

/** "2023 – present", "2020 – 2023", "From 2021", or null when there are no years at all. */
export function formatYearSpan(span: {
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
}) {
  const { yearStart, yearEnd, isCurrent } = span;
  if (yearStart && isCurrent) return `${yearStart} – present`;
  if (yearStart && yearEnd)
    return yearStart === yearEnd ? `${yearStart}` : `${yearStart} – ${yearEnd}`;
  if (yearStart) return `From ${yearStart}`;
  if (yearEnd) return `Until ${yearEnd}`;
  return isCurrent ? 'On sale now' : null;
}

export function describeOffering(offering: PublicCatalogOffering) {
  const years = formatYearSpan(offering);
  const fuels = formatFuelTypes(offering.fuelTypes);
  return years ? `${years} · ${fuels}` : fuels;
}

/** The schedule's heading: whose schedule it is, so nobody mistakes a typical one for the maker's. */
export function describeScheduleBasis(schedule: PublicCatalogSchedule) {
  if (schedule.basis === 'variant') return 'This variant’s schedule';
  return `Typical schedule for ${withArticle(
    `${fuelAdjective(schedule.fuelType)}${VEHICLE_TYPE_NOUNS[schedule.vehicleType]}`,
  )}`;
}

/**
 * "a petrol car", "an electric car", "an SUV", "a CNG car". An acronym takes
 * the article of its first letter's name, so S ("ess") gets "an" and C ("see")
 * gets "a".
 */
function withArticle(phrase: string) {
  const firstWord = phrase.split(' ')[0] ?? '';
  const isAcronym = firstWord.length > 1 && firstWord === firstWord.toUpperCase();
  const takesAn = isAcronym ? /^[AEFHILMNORSX]/.test(firstWord) : /^[aeiou]/i.test(firstWord);
  return `${takesAn ? 'an' : 'a'} ${phrase}`;
}

/** "petrol ", "CNG ", or nothing for `other`. Acronyms keep their capitals. */
function fuelAdjective(fuelType: FuelType) {
  if (fuelType === FuelType.Other) return '';
  if (fuelType === FuelType.CNG || fuelType === FuelType.LPG) return `${formatFuelType(fuelType)} `;
  return `${formatFuelType(fuelType).toLowerCase()} `;
}

const numberFormat = new Intl.NumberFormat('en-IN');

/** "Every 10,000 km or 12 months, whichever comes first". */
export function describeInterval(item: Pick<PublicCatalogScheduleItem, 'km' | 'months'>) {
  const km = item.km ? `${numberFormat.format(item.km)} km` : null;
  const months = item.months ? `${item.months} ${item.months === 1 ? 'month' : 'months'}` : null;
  if (km && months) return `Every ${km} or ${months}, whichever comes first`;
  if (km) return `Every ${km}`;
  if (months) return `Every ${months}`;
  return 'As needed';
}

export function formatSpecNumber(value: number) {
  return numberFormat.format(value);
}

/** Every variant a model page lists, across its generations. */
export function modelVariants(page: Pick<PublicCatalogModelPage, 'generations'>) {
  return page.generations.flatMap((generation) => generation.variants);
}

/** The years a model spans: its earliest generation's start to its latest's end, or "present". */
export function modelYearSpan(page: Pick<PublicCatalogModelPage, 'generations'>) {
  const starts = page.generations.flatMap((generation) => generation.yearStart ?? []);
  const ends = page.generations.flatMap((generation) => generation.yearEnd ?? []);
  const isCurrent = page.generations.some((generation) => generation.isCurrent);
  return formatYearSpan({
    yearStart: starts.length > 0 ? Math.min(...starts) : null,
    yearEnd: isCurrent || ends.length === 0 ? null : Math.max(...ends),
    isCurrent,
  });
}

/** Every fuel any of a model's variants is offered with, in the order they first appear. */
export function modelFuelTypes(page: Pick<PublicCatalogModelPage, 'generations'>) {
  return [...new Set(modelVariants(page).flatMap((variant) => variant.fuelTypes))];
}

/** "Petrol, CNG · 2014 – present · 12 variants": what tells a model from the make's others. */
export function describeMakeModel(model: PublicCatalogMakeModel) {
  return [
    formatFuelTypes(model.fuelTypes),
    formatYearSpan(model),
    `${model.variantCount} ${model.variantCount === 1 ? 'variant' : 'variants'}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

/** "Petrol, CNG · Manual · 2023 – present": what tells a variant from its siblings. */
export function describeModelVariant(variant: PublicCatalogModelVariant) {
  return [formatFuelTypes(variant.fuelTypes), variant.transmission, formatYearSpan(variant)]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

/**
 * The heading of a model page's schedule. It belongs to one variant: a typical
 * schedule reads the same for any of them, but the variant's own intervals are
 * named as that variant's.
 */
export function describeModelScheduleBasis(
  page: Pick<PublicCatalogModelPage, 'model' | 'representative' | 'schedule'>,
) {
  return page.schedule.basis === 'variant'
    ? `Schedule for the ${page.model.name} ${page.representative.variant.name}`
    : describeScheduleBasis(page.schedule);
}
