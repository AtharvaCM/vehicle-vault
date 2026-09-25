import { useEffect, useId, useMemo, useState } from 'react';
import {
  FuelType,
  MaintenanceCategory,
  OWNERSHIP_COST_DEFAULTS_AS_OF,
  ASSUMED_VALUE_KEPT_PER_YEAR,
  OWNERSHIP_COST_LIMITS,
  defaultEfficiency,
  estimateOwnershipCost,
  ownershipCostDefaults,
  ownershipCostEnergyUnits,
  VehicleType,
  type OwnershipCostBreakdown,
  type OwnershipCostDefaultedField,
  type OwnershipCostEfficiencySource,
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
import { format } from '@/lib/format';

import { describeInterval, formatFuelType } from '../utils/format-public-catalog';

/** What the visitor typed, field by field, exactly as typed. A field they haven't touched is absent. */
type EnteredValues = Partial<Record<OwnershipCostVisitorField, string>>;

const FIELD_ORDER: OwnershipCostVisitorField[] = [
  'kmPerMonth',
  'efficiency',
  'energyPrice',
  'serviceCostPerVisit',
  'servicesPerYear',
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

  const efficiencySource = defaultEfficiency(base)?.source ?? null;

  const result = estimateOwnershipCost({ ...base, ...visitorInput(entered) });
  // Only a field the visitor has typed in is ever marked wrong: the calculator
  // never opens in an error state.
  const problems = new Map(
    (result.kind === 'cannot-estimate' ? result.problems : [])
      .filter(
        (problem) => problem.field !== 'serviceInterval' && entered[problem.field] !== undefined,
      )
      .map((problem) => [problem.field, describeProblem(problem, labels, units)]),
  );
  const hasEntered = Object.keys(entered).length > 0;

  return (
    <section
      aria-labelledby="running-cost-heading"
      className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
      data-testid="running-cost-calculator"
    >
      <h2 className="text-lead font-semibold tracking-tight text-fg" id="running-cost-heading">
        What it costs to run
      </h2>
      <p className="mt-1 text-ui leading-6 text-fg-2">
        Fuel and servicing: an estimate, not a quote. Change any figure to match how you drive.
      </p>

      <form
        aria-label="Running cost inputs"
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        {FIELD_ORDER.map((field) => (
          <CalculatorField
            adornment={labels[field]}
            assumption={assumptionHint(field, base, units, efficiencySource)}
            defaultValue={field === 'onRoadPrice' ? null : defaults[field]}
            enteredValue={entered[field]}
            problem={problems.get(field) ?? null}
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
          <CannotEstimate
            entered={entered}
            labels={labels}
            problems={result.problems}
            units={units}
          />
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
    servicesPerYear: { label: 'Services per year' },
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
  /** What is wrong with what the visitor typed, said at the field; null when nothing is. */
  problem: string | null;
  optional: boolean;
  onChange: (value: string) => void;
};

function CalculatorField({
  adornment,
  assumption,
  defaultValue,
  enteredValue,
  problem,
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
      <Label className="text-fg" htmlFor={id}>
        {adornment.label}
      </Label>
      <div className="flex items-center gap-2">
        {adornment.prefix ? (
          <span className="text-ui text-fg-2" id={prefixId}>
            {adornment.prefix}
          </span>
        ) : null}
        <Input
          aria-describedby={describedBy}
          aria-invalid={problem ? true : undefined}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-surface text-field tabular-nums aria-invalid:border-late sm:text-ui"
          id={id}
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
        {adornment.suffix ? (
          <span className="shrink-0 text-ui text-fg-2" id={suffixId}>
            {adornment.suffix}
          </span>
        ) : null}
      </div>
      <p className="text-caption leading-5 text-fg-3" id={hintId}>
        {problem ? (
          <span className="font-medium text-late">{problem}</span>
        ) : isEntered ? (
          <span className="font-medium text-fg-2">Your figure</span>
        ) : optional ? (
          assumption
        ) : defaultValue === null ? (
          'Enter your figure'
        ) : (
          <>
            <span className="font-medium text-soon">Assumed</span> · {assumption}
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
            className="rounded-lg border border-line bg-page p-3"
            key={title}
          >
            <h3 className="text-ui font-medium text-fg-2">{title}</h3>
            <p className="mt-1 text-title font-semibold tabular-nums tracking-tight text-fg">
              {format.money(breakdown.total)}
            </p>
            <dl className="mt-2 space-y-1 text-ui">
              <BreakdownRow label={labels.energy} value={breakdown.energy} />
              <BreakdownRow label="Service" value={breakdown.service} />
            </dl>
          </section>
        ))}
      </div>

      <OwnershipView estimate={estimate} />

      <div className="rounded-lg bg-page p-3 text-ui leading-6 text-fg-2">
        <h3 className="font-medium text-fg">How this is worked out</h3>
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
          <li>
            Running cost is fuel and servicing only; the price you pay for it is counted in the cost
            of owning it, never here.
          </li>
          <li>Not included: insurance, tyres, repairs, loan interest, parking and tolls.</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * The cost of owning it over the years, apart from the running cost: shown once
 * the visitor adds an on-road price, with the resale it assumes said plainly.
 */
function OwnershipView({ estimate }: { estimate: OwnershipCostEstimate }) {
  const { years } = estimate.inputs;
  const period = `${formatQuantity(years)} ${years === 1 ? 'year' : 'years'}`;
  const { ownership } = estimate;

  if (!ownership) {
    return (
      <p className="text-ui text-fg-2">
        Add the on-road price above to see the cost of owning it over {period}, resale included.
      </p>
    );
  }

  const keptPercent = Math.round(ASSUMED_VALUE_KEPT_PER_YEAR ** years * 100);
  return (
    <section
      aria-labelledby="ownership-heading"
      className="rounded-lg border border-line p-3"
      data-testid="ownership-cost"
    >
      <h3 className="text-ui font-medium text-fg-2" id="ownership-heading">
        Cost of owning it over {period}
      </h3>
      <p className="mt-1 text-title font-semibold tabular-nums tracking-tight text-fg">
        {format.money(ownership.total)}
      </p>
      <p className="text-ui text-fg-2">about {format.money(ownership.perMonth)} a month</p>
      <dl className="mt-2 space-y-1 text-ui">
        <BreakdownRow label="On-road price" value={ownership.onRoadPrice} />
        <BreakdownRow
          label={`Less resale after ${period} (assumed, ${keptPercent}% kept)`}
          value={-ownership.resaleValue}
        />
        <BreakdownRow label={`Running it for ${period}`} value={ownership.running} />
      </dl>
    </section>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-fg-2">{label}</dt>
      <dd className="tabular-nums text-fg">{format.money(value)}</dd>
    </div>
  );
}

function CannotEstimate({
  entered,
  labels,
  problems,
  units,
}: {
  entered: EnteredValues;
  labels: ReturnType<typeof fieldLabels>;
  problems: OwnershipCostProblem[];
  units: OwnershipCostEnergyUnits;
}) {
  const typedWrong = problems.some(
    (problem) => problem.field !== 'serviceInterval' && entered[problem.field] !== undefined,
  );

  if (!typedWrong) {
    // Nothing the visitor typed is wrong: a figure the page has no default for
    // is simply still to be added. Say what, without an alarm.
    return (
      <div className="rounded-lg bg-page p-3 text-ui leading-6 text-fg-2">
        {problems.map((problem) => (
          <p key={problem.field}>{describeMissing(problem, labels, units)}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-soon/30 bg-soon-tint p-3 text-ui leading-6 text-soon">
      <h3 className="font-medium">Can’t estimate yet</h3>
      <p className="mt-1">Fix the figure marked above to see the cost.</p>
    </div>
  );
}

function describeMissing(
  problem: OwnershipCostProblem,
  labels: ReturnType<typeof fieldLabels>,
  units: OwnershipCostEnergyUnits,
) {
  if (problem.field === 'serviceInterval') return describeProblem(problem, labels, units);
  const name = labels[problem.field].label.replace(' (optional)', '').toLowerCase();
  return `Add your ${name} to see the cost.`;
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
  efficiencySource: OwnershipCostEfficiencySource | null,
) {
  switch (field) {
    case 'kmPerMonth':
      return 'a typical month’s driving';
    case 'efficiency':
      if (efficiencySource === 'typical') {
        return `typical for ${formatFuelType(base.fuelType).toLowerCase()} ${vehicleNoun(base.vehicleType)}; we have no claimed figure for this one`;
      }
      return units.kind === 'electric'
        ? 'the battery over the claimed range; real use is usually higher'
        : 'the maker’s claimed figure; real-world mileage is usually lower';
    case 'energyPrice':
      return `a typical price in ${formatAsOf()}, not your city’s`;
    case 'serviceCostPerVisit':
      return `a typical authorised-workshop service for ${vehicleNoun(base.vehicleType)}`;
    case 'servicesPerYear':
      return 'what the schedule’s regular service interval implies, at a typical distance';
    case 'years':
      return 'a typical ownership period';
    case 'onRoadPrice':
      return 'Add it to see the cost of owning it, resale included.';
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
      if (estimate.efficiencySource === 'typical') {
        return `a typical ${formatQuantity(inputs.efficiency)} ${units.efficiencyUnit}`;
      }
      return units.kind === 'electric'
        ? `${formatQuantity(inputs.efficiency)} kWh/100 km from the claimed range`
        : `the claimed ${formatQuantity(inputs.efficiency)} ${units.efficiencyUnit}`;
    case 'energyPrice':
      return `${labels.energyPrice.label.toLowerCase()} of ₹${formatQuantity(inputs.energyPrice)} per ${units.priceUnit} (${formatAsOf()})`;
    case 'serviceCostPerVisit':
      return `${format.money(inputs.serviceCostPerVisit)} a service, typical for ${vehicleNoun(vehicleType)}`;
    case 'servicesPerYear':
      return `${formatQuantity(inputs.servicesPerYear)} services a year`;
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

function formatQuantity(value: number) {
  return format.number(value, { decimals: 1 });
}

/** "September 2026", from the defaults' "2026-09". */
function formatAsOf() {
  return format.date(`${OWNERSHIP_COST_DEFAULTS_AS_OF}-01`, 'monthYearLong');
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
