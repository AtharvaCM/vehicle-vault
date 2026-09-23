import { useEffect, useId, useMemo, useState } from 'react';
import {
  FuelType,
  MaintenanceCategory,
  OWNERSHIP_COST_DEFAULTS_AS_OF,
  OWNERSHIP_COST_LIMITS,
  estimateOwnershipCost,
  ownershipCostDefaults,
  ownershipCostEnergyUnits,
  VehicleType,
  type OwnershipCostBreakdown,
  type OwnershipCostDefaultedField,
  type OwnershipCostEnergyUnits,
  type OwnershipCostEstimate,
  type OwnershipCostInput,
  type OwnershipCostProblem,
  type OwnershipCostVisitorField,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils/format-currency';

import { describeInterval, formatFuelType } from '../utils/format-public-catalog';

/** What the visitor typed, field by field, exactly as typed. A field they haven't touched is absent. */
type EnteredValues = Partial<Record<OwnershipCostVisitorField, string>>;

const FIELD_ORDER: OwnershipCostVisitorField[] = [
  'kmPerMonth',
  'efficiency',
  'energyPrice',
  'serviceCostPerVisit',
  'years',
  'onRoadPrice',
];

const STORAGE_PREFIX = 'vehicle-vault.running-cost:';

type RunningCostCalculatorProps = {
  page: PublicCatalogVariantPage;
};

/**
 * "What will it cost me to run?" — the page's one interactive island. It opens
 * on the variant's claimed efficiency and the default price for its fuel, and
 * keeps whatever the visitor changes in `localStorage`, per variant.
 *
 * The first render uses the defaults alone and saved inputs are read after
 * mount, so a prerendered page and its hydration render the same markup.
 */
export function RunningCostCalculator({ page }: RunningCostCalculatorProps) {
  const storageKey = `${STORAGE_PREFIX}${page.segment}/${page.make.slug}/${page.model.slug}/${page.generation.slug}/${page.variant.slug}`;

  // A different variant starts from its own defaults and its own saved inputs.
  return <Calculator key={storageKey} page={page} storageKey={storageKey} />;
}

function Calculator({ page, storageKey }: RunningCostCalculatorProps & { storageKey: string }) {
  const [entered, setEntered] = useState<EnteredValues>({});
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = readSaved(storageKey);
    if (saved) setEntered(saved);
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    // Until the saved inputs are read, `entered` is only the empty first render.
    if (restored) writeSaved(storageKey, entered);
  }, [entered, restored, storageKey]);

  const base = useMemo(() => baseInput(page), [page]);
  const defaults = useMemo(() => ownershipCostDefaults(base), [base]);
  const units = ownershipCostEnergyUnits(base.fuelType);
  const labels = fieldLabels(base.fuelType, units);

  const result = estimateOwnershipCost({ ...base, ...visitorInput(entered) });
  const problemFields = new Set(
    result.kind === 'cannot-estimate' ? result.problems.map((p) => p.field) : [],
  );
  const hasEntered = Object.keys(entered).length > 0;

  return (
    <section
      aria-labelledby="running-cost-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      data-testid="running-cost-calculator"
    >
      <h2 className="text-lg font-semibold tracking-tight text-slate-950" id="running-cost-heading">
        Running cost
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        An estimate, not a quote. Change any figure to match how you drive.
      </p>

      <form
        aria-label="Running cost inputs"
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        {FIELD_ORDER.map((field) => (
          <CalculatorField
            adornment={labels[field]}
            assumption={assumptionHint(field, base, units)}
            defaultValue={field === 'onRoadPrice' ? null : defaults[field]}
            enteredValue={entered[field]}
            invalid={problemFields.has(field)}
            key={field}
            optional={field === 'onRoadPrice'}
            onChange={(value) => setEntered((current) => ({ ...current, [field]: value }))}
          />
        ))}
      </form>

      {hasEntered ? (
        <Button
          className="mt-3"
          onClick={() => setEntered({})}
          size="sm"
          type="button"
          variant="outline"
        >
          Reset to the assumed figures
        </Button>
      ) : null}

      <div aria-live="polite" className="mt-5">
        {result.kind === 'estimate' ? (
          <EstimateView estimate={result} labels={labels} vehicleType={base.vehicleType} />
        ) : (
          <CannotEstimate labels={labels} problems={result.problems} units={units} />
        )}
      </div>
    </section>
  );
}

type FieldLabel = { label: string; prefix?: string; suffix?: string };

function fieldLabels(
  fuelType: FuelType,
  units: OwnershipCostEnergyUnits,
): Record<OwnershipCostVisitorField, FieldLabel> & { energy: string } {
  const electric = units.kind === 'electric';
  const fuelName =
    fuelType === FuelType.Hybrid || fuelType === FuelType.Other ? 'Fuel' : formatFuelType(fuelType);

  return {
    kmPerMonth: { label: 'Distance per month', suffix: 'km' },
    efficiency: { label: electric ? 'Energy use' : 'Mileage', suffix: units.efficiencyUnit },
    energyPrice: {
      label: electric ? 'Electricity price' : `${fuelName} price`,
      prefix: '₹',
      suffix: `per ${units.priceUnit}`,
    },
    serviceCostPerVisit: { label: 'Service cost per visit', prefix: '₹' },
    years: { label: 'Years of ownership', suffix: 'years' },
    onRoadPrice: { label: 'On-road price (optional)', prefix: '₹' },
    energy: electric ? 'Electricity' : 'Fuel',
  };
}

type CalculatorFieldProps = {
  adornment: FieldLabel;
  assumption: string;
  defaultValue: number | null;
  enteredValue: string | undefined;
  invalid: boolean;
  optional: boolean;
  onChange: (value: string) => void;
};

function CalculatorField({
  adornment,
  assumption,
  defaultValue,
  enteredValue,
  invalid,
  optional,
  onChange,
}: CalculatorFieldProps) {
  const id = useId();
  const prefixId = `${id}-prefix`;
  const suffixId = `${id}-suffix`;
  const hintId = `${id}-hint`;
  const describedBy = [adornment.prefix && prefixId, adornment.suffix && suffixId, hintId]
    .filter(Boolean)
    .join(' ');
  const isEntered = enteredValue !== undefined;
  const value = enteredValue ?? (defaultValue === null ? '' : String(defaultValue));

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-slate-900" htmlFor={id}>
        {adornment.label}
      </Label>
      <div className="flex items-center gap-2">
        {adornment.prefix ? (
          <span className="text-sm text-slate-600" id={prefixId}>
            {adornment.prefix}
          </span>
        ) : null}
        <Input
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-white text-base tabular-nums aria-[invalid=true]:border-red-500 sm:text-sm"
          id={id}
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
        {adornment.suffix ? (
          <span className="shrink-0 text-sm text-slate-600" id={suffixId}>
            {adornment.suffix}
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-slate-500" id={hintId}>
        {isEntered ? (
          <span className="font-medium text-slate-700">Your figure</span>
        ) : optional ? (
          assumption
        ) : defaultValue === null ? (
          'Enter your figure'
        ) : (
          <>
            <span className="font-medium text-amber-700">Assumed</span> · {assumption}
          </>
        )}
      </p>
    </div>
  );
}

function EstimateView({
  estimate,
  labels,
  vehicleType,
}: {
  estimate: OwnershipCostEstimate;
  labels: ReturnType<typeof fieldLabels>;
  vehicleType: OwnershipCostInput['vehicleType'];
}) {
  const { years } = estimate.inputs;
  const periods: Array<[title: string, breakdown: OwnershipCostBreakdown]> = [
    ['Per month', estimate.perMonth],
    ['Per year', estimate.perYear],
    [`Over ${formatQuantity(years)} ${years === 1 ? 'year' : 'years'}`, estimate.overYears],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {periods.map(([title, breakdown]) => (
          <section
            aria-label={title}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            key={title}
          >
            <h3 className="text-sm font-medium text-slate-600">{title}</h3>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">
              {formatCurrency(breakdown.total)}
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <BreakdownRow label={labels.energy} value={breakdown.energy} />
              <BreakdownRow label="Service" value={breakdown.service} />
              {breakdown.purchase !== null ? (
                <BreakdownRow label="Purchase" value={breakdown.purchase} />
              ) : null}
            </dl>
          </section>
        ))}
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <h3 className="font-medium text-slate-900">How this is worked out</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {estimate.defaulted.length > 0 ? (
            <li>
              Assumed, not entered:{' '}
              {estimate.defaulted
                .map((field) => describeAssumed(field, estimate, labels, vehicleType))
                .join('; ')}
              .
            </li>
          ) : (
            <li>Every figure above is yours.</li>
          )}
          <li>
            Service: about {formatQuantity(estimate.serviceVisitsPerYear)}{' '}
            {estimate.serviceVisitsPerYear === 1 ? 'visit' : 'visits'} a year, from the schedule’s
            regular service ({describeInterval(estimate.inputs.serviceInterval).toLowerCase()}).
          </li>
          {estimate.inputs.onRoadPrice !== null ? (
            <li>
              Purchase: the on-road price counted once over {formatQuantity(years)}{' '}
              {years === 1 ? 'year' : 'years'} and spread evenly across each year and month.
            </li>
          ) : null}
          <li>Not included: insurance, tyres, repairs, loan interest, parking and tolls.</li>
        </ul>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums text-slate-900">{formatCurrency(value)}</dd>
    </div>
  );
}

function CannotEstimate({
  labels,
  problems,
  units,
}: {
  labels: ReturnType<typeof fieldLabels>;
  problems: OwnershipCostProblem[];
  units: OwnershipCostEnergyUnits;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
      <h3 className="font-medium">Can’t estimate yet</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {problems.map((problem) => (
          <li key={problem.field}>{describeProblem(problem, labels, units)}</li>
        ))}
      </ul>
    </div>
  );
}

function describeProblem(
  { field, problem }: OwnershipCostProblem,
  labels: ReturnType<typeof fieldLabels>,
  units: OwnershipCostEnergyUnits,
) {
  if (field === 'serviceInterval') {
    return 'This variant’s schedule has no regular service interval to work from.';
  }

  const { label } = labels[field];
  const name = label.replace(' (optional)', '');
  if (problem === 'missing') return `Enter ${name.toLowerCase()}.`;
  if (problem === 'not-a-number') return `${name} needs to be a number.`;

  const limits = limitsFor(field, units);
  const unit = labels[field].suffix ? ` ${labels[field].suffix}` : '';
  const money = labels[field].prefix ? '₹' : '';
  return `${name} needs to be between ${money}${formatQuantity(limits.min)} and ${money}${formatQuantity(limits.max)}${unit}.`;
}

function limitsFor(field: OwnershipCostVisitorField, units: OwnershipCostEnergyUnits) {
  if (field === 'efficiency') {
    return units.kind === 'electric'
      ? OWNERSHIP_COST_LIMITS.electricEfficiency
      : OWNERSHIP_COST_LIMITS.liquidEfficiency;
  }
  return OWNERSHIP_COST_LIMITS[field];
}

/** The note under an untouched field saying where its figure comes from. */
function assumptionHint(
  field: OwnershipCostVisitorField,
  base: ReturnType<typeof baseInput>,
  units: OwnershipCostEnergyUnits,
) {
  switch (field) {
    case 'kmPerMonth':
      return 'a typical month’s driving';
    case 'efficiency':
      return units.kind === 'electric'
        ? 'the battery over the claimed range; real use is usually higher'
        : 'the maker’s claimed figure; real-world mileage is usually lower';
    case 'energyPrice':
      return `a typical price in ${formatAsOf()}, not your city’s`;
    case 'serviceCostPerVisit':
      return `a typical authorised-workshop service for ${vehicleNoun(base.vehicleType)}`;
    case 'years':
      return 'a typical ownership period';
    case 'onRoadPrice':
      return 'Add it to see the total cost of owning it.';
  }
}

function describeAssumed(
  field: OwnershipCostDefaultedField,
  estimate: OwnershipCostEstimate,
  labels: ReturnType<typeof fieldLabels>,
  vehicleType: OwnershipCostInput['vehicleType'],
) {
  const { inputs, units } = estimate;
  switch (field) {
    case 'kmPerMonth':
      return `${formatQuantity(inputs.kmPerMonth)} km a month`;
    case 'efficiency':
      return units.kind === 'electric'
        ? `${formatQuantity(inputs.efficiency)} kWh/100 km from the claimed range`
        : `the claimed ${formatQuantity(inputs.efficiency)} ${units.efficiencyUnit}`;
    case 'energyPrice':
      return `${labels.energyPrice.label.toLowerCase()} of ₹${formatQuantity(inputs.energyPrice)} per ${units.priceUnit} (${formatAsOf()})`;
    case 'serviceCostPerVisit':
      return `${formatCurrency(inputs.serviceCostPerVisit)} a service, typical for ${vehicleNoun(vehicleType)}`;
    case 'years':
      return `${formatQuantity(inputs.years)} years of ownership`;
  }
}

const VEHICLE_NOUNS: Record<OwnershipCostInput['vehicleType'], string> = {
  [VehicleType.Car]: 'cars',
  [VehicleType.SUV]: 'SUVs',
  [VehicleType.Van]: 'vans',
  [VehicleType.Motorcycle]: 'motorcycles',
  [VehicleType.Truck]: 'trucks',
  [VehicleType.Other]: 'vehicles',
};

function vehicleNoun(vehicleType: OwnershipCostInput['vehicleType']) {
  return VEHICLE_NOUNS[vehicleType] ?? 'vehicles';
}

const quantityFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

function formatQuantity(value: number) {
  return quantityFormat.format(value);
}

/** "September 2026", from the defaults' "2026-09". */
function formatAsOf() {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${OWNERSHIP_COST_DEFAULTS_AS_OF}-01T00:00:00Z`));
}

/** The parts of the estimate the page supplies: the vehicle, its claims and its service interval. */
function baseInput(page: PublicCatalogVariantPage) {
  const { calculatorSeed, schedule, vehicleType } = page;
  const periodic = schedule.items.find(
    (item) => item.category === MaintenanceCategory.PeriodicService,
  );

  return {
    fuelType: calculatorSeed.fuelType,
    vehicleType,
    claimed: {
      mileage: calculatorSeed.claimedMileage,
      rangeKm: calculatorSeed.claimedRangeKm,
      batteryKwh: calculatorSeed.batteryKwh,
    },
    serviceInterval: periodic ? { km: periodic.km, months: periodic.months } : null,
  } satisfies OwnershipCostInput;
}

/**
 * The visitor's side of the estimate: an untouched field stays `undefined` so
 * the estimator fills and names its default, a cleared one is `null`, and
 * anything unreadable is NaN, which the estimator refuses.
 */
function visitorInput(entered: EnteredValues): Partial<OwnershipCostInput> {
  const input: Partial<Record<OwnershipCostVisitorField, number | null>> = {};
  for (const field of FIELD_ORDER) {
    const raw = entered[field];
    if (raw !== undefined) input[field] = parseEntered(raw);
  }
  return input;
}

/** "1,00,000", "₹ 95.5" and " 20 " all read; blank is null; anything else is NaN. */
export function parseEntered(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (cleaned === '') return null;
  return Number(cleaned);
}

function readSaved(storageKey: string): EnteredValues | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const saved: EnteredValues = {};
    for (const field of FIELD_ORDER) {
      const value = (parsed as Record<string, unknown>)[field];
      if (typeof value === 'string') saved[field] = value;
    }
    return saved;
  } catch {
    // A blocked or corrupt store just means starting from the defaults.
    return null;
  }
}

function writeSaved(storageKey: string, entered: EnteredValues) {
  try {
    if (Object.keys(entered).length === 0) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(entered));
  } catch {
    // Storage full or blocked: the calculator still works, it just won't remember.
  }
}
