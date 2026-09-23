import type { VehicleCatalogImportVariantChange } from '@vehicle-vault/shared';

type OfferingLike = {
  fuelTypes: string[];
  isCurrent?: boolean;
  yearEnd?: number;
  yearStart?: number;
};

type FieldChange = VehicleCatalogImportVariantChange['changes'][number];

function formatFuelTypes(offerings: OfferingLike[]) {
  const fuelTypes = [...new Set(offerings.flatMap((offering) => offering.fuelTypes))].sort();

  return fuelTypes.length
    ? fuelTypes.map((fuelType) => fuelType.charAt(0).toUpperCase() + fuelType.slice(1)).join(' / ')
    : 'None';
}

function formatYearRange(offering: Pick<OfferingLike, 'isCurrent' | 'yearEnd' | 'yearStart'>) {
  const start = offering.yearStart ?? '?';
  const end = offering.isCurrent ? 'current' : (offering.yearEnd ?? '?');

  return `${start} to ${end}`;
}

/** The years a variant covers across its offerings, as one range. */
function formatYears(offerings: OfferingLike[]) {
  const starts = offerings.flatMap((offering) =>
    offering.yearStart === undefined ? [] : [offering.yearStart],
  );
  const ends = offerings.flatMap((offering) =>
    offering.yearEnd === undefined ? [] : [offering.yearEnd],
  );

  return formatYearRange({
    yearStart: starts.length ? Math.min(...starts) : undefined,
    yearEnd: ends.length ? Math.max(...ends) : undefined,
    isCurrent: offerings.some((offering) => offering.isCurrent),
  });
}

function formatOffering(offering: OfferingLike) {
  return `${formatFuelTypes([offering])}, ${formatYearRange(offering)}`;
}

/**
 * What a changed variant's publish would change, field by field (old → new),
 * so a curator reviews the values rather than a bare variant name. Fuel types
 * and years are summarised across the variant's offerings; when those match
 * and only the way offerings are split differs, the offerings are listed.
 */
export function describeVariantChanges(
  published: OfferingLike[],
  incoming: OfferingLike[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  const compare = (field: string, before: string, after: string) => {
    if (before !== after) {
      changes.push({ field, before, after });
    }
  };

  compare('Fuel types', formatFuelTypes(published), formatFuelTypes(incoming));
  compare('Years', formatYears(published), formatYears(incoming));
  compare('Offerings', String(published.length), String(incoming.length));

  if (!changes.length) {
    compare(
      'Offerings',
      published.map(formatOffering).sort().join('; '),
      incoming.map(formatOffering).sort().join('; '),
    );
  }

  return changes;
}
