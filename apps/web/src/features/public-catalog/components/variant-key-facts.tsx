import { FuelType, type PublicCatalogVariantPage } from '@vehicle-vault/shared';

import { formatFuelType, formatSpecNumber } from '../utils/format-public-catalog';

type Fact = { label: string; value: string | null };

function withUnit(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? null : `${formatSpecNumber(value)} ${unit}`;
}

/** The facts a buyer looks for first, in order; null where the catalog has no figure. */
export function variantKeyFacts(page: PublicCatalogVariantPage): Fact[] {
  const { specs, calculatorSeed } = page;
  const electric = calculatorSeed.fuelType === FuelType.Electric;
  return [
    // The catalog holds no prices yet; saying so beats leaving the buyer's first question out.
    { label: 'Price', value: null },
    electric
      ? { label: 'Range', value: withUnit(specs?.rangeKm, 'km') }
      : {
          label: 'Mileage',
          value: withUnit(
            specs?.mileageCombined,
            calculatorSeed.fuelType === FuelType.CNG ? 'km/kg' : 'km/l',
          ),
        },
    electric
      ? { label: 'Battery', value: withUnit(specs?.batteryKwh, 'kWh') }
      : { label: 'Engine', value: withUnit(specs?.engineCc, 'cc') },
    { label: 'Transmission', value: specs?.transmission ?? null },
    { label: 'Fuel', value: formatFuelType(calculatorSeed.fuelType) },
    {
      label: 'Seats',
      value: specs?.seatingCapacity ? String(specs.seatingCapacity) : null,
    },
  ];
}

/**
 * The key-facts strip under a variant page's title (#344): the same six facts
 * on every page, with an honest gap where the catalog has no figure, so a thin
 * record reads as "not in our data yet" rather than as a missing section.
 */
export function VariantKeyFacts({ page }: { page: PublicCatalogVariantPage }) {
  const facts = variantKeyFacts(page);
  const anyMissing = facts.some((fact) => fact.value === null);

  return (
    <section aria-label="Key facts" data-testid="variant-key-facts">
      <dl className="grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div
            className="border-b border-r border-line-subtle px-4 py-3 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(3n)]:border-r lg:last:border-r-0"
            key={fact.label}
          >
            <dt className="text-small text-fg-3">{fact.label}</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular-nums">
              {fact.value ?? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">Not in our data yet</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {anyMissing ? <p className="mt-2 text-small text-fg-3">— Not in our data yet.</p> : null}
    </section>
  );
}
