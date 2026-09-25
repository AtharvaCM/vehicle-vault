import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  CircleDot,
  ClipboardCheck,
  Clock,
  HelpCircle,
  Plus,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  isTwoWheeler,
  TyrePosition,
  type MaintenanceRecord,
  type Tyre,
  type TyreCondition,
  type TyreConditionLevel,
  type TyreInspection,
  type Vehicle,
} from '@vehicle-vault/shared';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { SectionHeader } from '@/components/shared/section-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import type { useMaintenanceRecords } from '../../maintenance/hooks/use-maintenance-records';
import { TyreFormDialog } from '../../tyres/components/tyre-form-dialog';
import { TyreInspectionDialog } from '../../tyres/components/tyre-inspection-dialog';
import { TyreSetupDialog } from '../../tyres/components/tyre-setup-dialog';
import {
  useDeleteTyre,
  useVehicleTyreCondition,
  useVehicleTyreInspections,
  useVehicleTyres,
} from '../../tyres/hooks/use-tyres';
import { formatDotCode } from '../../tyres/schemas/tyre-form.schema';
import { tyreHistory, type TyreHistoryItem } from '../../tyres/utils/tyre-history';
import { LEVEL_WORDS, tyreVerdict, wheelReading } from '../../tyres/utils/tyre-verdict';
import { useVehicleAccess } from '../context/vehicle-access';
import { useVariantSpecs } from '../hooks/use-variant-specs';
import { useVehicleIntervals } from '../hooks/use-vehicle-intervals';
import { getTyreInsights, type TyreMetric, type TyreStatus } from '../utils/get-tyre-status';

interface VehicleTyreTrackerProps {
  vehicle: Vehicle | null;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
}

/** Past this many entries the history folds the rest behind "Show all". */
const HISTORY_PREVIEW = 8;

/**
 * More → Tyres. With tyres on file: a verdict line on top, led by the tyre
 * that needs the most attention, a diagram matched to the vehicle type with
 * each wheel's tread and age, and one history list. Without: one card that
 * starts a three-step setup. The verdicts are the API's (tread and age
 * limits), never worked out here; rotation and alignment come from the
 * service intervals the API resolves.
 */
export function VehicleTyreTracker({ vehicle, maintenanceQuery }: VehicleTyreTrackerProps) {
  const { canEdit } = useVehicleAccess();
  const records = useMemo<MaintenanceRecord[]>(
    () => maintenanceQuery.data ?? [],
    [maintenanceQuery.data],
  );

  // The API resolves these per vehicle, using catalog data when the vehicle is
  // linked to a variant. Deciding an interval here instead would put this tab
  // and the alert engine into open disagreement about the same vehicle.
  const intervalsQuery = useVehicleIntervals(vehicle?.id ?? '');
  const conditionQuery = useVehicleTyreCondition(vehicle?.id ?? '');
  const tyresQuery = useVehicleTyres(vehicle?.id ?? '');
  const inspectionsQuery = useVehicleTyreInspections(vehicle?.id ?? '');
  const deleteTyre = useDeleteTyre(vehicle?.id ?? '');
  // The size printed on the sidewall, from the catalogue, so buying a tyre
  // does not start with a trip to the car.
  const specsQuery = useVariantSpecs(
    vehicle?.make ?? '',
    vehicle?.model ?? '',
    vehicle?.variant?.trim() ?? '',
  );
  const catalogTyreSize = vehicle?.variant?.trim()
    ? specsQuery.data?.tyreSize?.trim() || null
    : null;

  const [openDialog, setOpenDialog] = useState<'tyre' | 'inspection' | 'setup' | null>(null);
  // Kept after the dialog closes, so it does not turn into "Add a tyre" while
  // it animates out.
  const [editTarget, setEditTarget] = useState<Tyre | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const tyres = useMemo(() => tyresQuery.data ?? [], [tyresQuery.data]);
  const tyreById = useMemo(() => new Map(tyres.map((tyre) => [tyre.id, tyre])), [tyres]);
  const readingsByTyre = useMemo(() => {
    const byTyre = new Map<string, TyreInspection[]>();
    for (const reading of inspectionsQuery.data ?? []) {
      byTyre.set(reading.tyreId, [...(byTyre.get(reading.tyreId) ?? []), reading]);
    }
    return byTyre;
  }, [inspectionsQuery.data]);

  const insights = useMemo(
    () => getTyreInsights({ vehicle, records, intervals: intervalsQuery.data }),
    [vehicle, records, intervalsQuery.data],
  );
  const history = useMemo(
    () => tyreHistory({ tyres, readings: inspectionsQuery.data ?? [], records: insights.records }),
    [tyres, inspectionsQuery.data, insights.records],
  );

  function startEditing(tyre: Tyre) {
    setEditTarget(tyre);
    setIsEditOpen(true);
  }

  async function handleDelete(tyre: Tyre) {
    try {
      await deleteTyre.mutateAsync(tyre.id);
      appToast.success({
        title: 'Tyre deleted',
        description: `${format.enumLabel('tyrePosition', tyre.position)} tyre removed from the tracker.`,
      });
    } catch (error) {
      appToast.error({
        title: "Couldn't delete the tyre",
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    }
  }

  // Tyre history is derived partly from maintenance records; without this the
  // panel reports "no rotations logged" whenever the records request fails.
  if (maintenanceQuery.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => maintenanceQuery.refetch()} variant="secondary">
            Retry
          </Button>
        }
        description={getApiErrorMessage(
          maintenanceQuery.error,
          "We couldn't load this vehicle's service history, so tyre status is unavailable.",
        )}
        title="Unable to load tyre history"
      />
    );
  }

  // An empty record set looks identical to "nothing was ever logged", so
  // rendering before the fetch settles would show a confident verdict built from
  // no data at all.
  if (maintenanceQuery.isPending) {
    return (
      <LoadingState
        description="Reading this vehicle's tyre and wheel service history."
        title="Loading tyre status"
      />
    );
  }

  const measured = conditionQuery.data?.tyres ?? [];
  const hasTyres = measured.length > 0;
  // Two-wheelers get a front/rear layout and carry no rotation service of their
  // own, so the rotation row goes and alignment is named for them.
  const twoWheeler = vehicle ? isTwoWheeler(vehicle.vehicleType) : false;
  const verdict = tyreVerdict(measured);
  const serviceMetrics: Array<[string, TyreMetric]> = [
    ...(twoWheeler ? [] : ([['Tyre rotation', insights.rotation]] as Array<[string, TyreMetric]>)),
    [twoWheeler ? 'Wheel alignment / balancing' : 'Wheel alignment', insights.alignment],
  ];
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <div className="space-y-6" data-testid="tyres">
      {hasTyres ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {verdict ? <VerdictLine verdict={verdict} /> : null}
            {catalogTyreSize ? <SizeLine size={catalogTyreSize} /> : null}
          </div>
          {canEdit ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button onClick={() => setOpenDialog('inspection')} type="button">
                <ClipboardCheck aria-hidden="true" />
                Log inspection
              </Button>
              <Button onClick={() => setOpenDialog('tyre')} type="button" variant="outline">
                <Plus aria-hidden="true" />
                Add tyre
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Card data-testid="tyres-empty">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <CircleDot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-3" />
              <div className="min-w-0">
                <p className="text-body font-semibold text-fg">Add your tyres</p>
                <p className="text-small text-fg-2">
                  Tread depth and age decide if a tyre is safe. Service dates can’t tell you either.
                </p>
                {catalogTyreSize ? <SizeLine size={catalogTyreSize} /> : null}
              </div>
            </div>
            {canEdit ? (
              <Button className="shrink-0" onClick={() => setOpenDialog('setup')} type="button">
                Add tyres
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {hasTyres ? (
        <WheelDiagram
          conditions={measured}
          deletingId={deleteTyre.isPending ? (deleteTyre.variables ?? null) : null}
          onDelete={canEdit ? handleDelete : undefined}
          onEdit={canEdit ? startEditing : undefined}
          readingsByTyre={readingsByTyre}
          tyreById={tyreById}
          twoWheeler={twoWheeler}
        />
      ) : null}

      <section aria-labelledby="tyre-services" className="space-y-2">
        <SectionHeader as="h3" id="tyre-services" title="Rotation and alignment" />
        <Card className="divide-y divide-line-subtle p-0">
          {serviceMetrics.map(([label, metric]) => (
            <MetricRow key={label} label={label} metric={metric} />
          ))}
        </Card>
      </section>

      <section aria-labelledby="tyre-history" className="space-y-2">
        <SectionHeader as="h3" id="tyre-history" title="History" />
        {history.length === 0 ? (
          <p className="px-1 text-small text-fg-3">
            Inspections, rotations, replacements and punctures show up here.
          </p>
        ) : (
          <Card className="p-0">
            <ul aria-label="Tyre history, newest first" className="divide-y divide-line-subtle">
              {visibleHistory.map((item) => (
                <HistoryItem item={item} key={item.key} />
              ))}
            </ul>
            {history.length > HISTORY_PREVIEW ? (
              <div className="border-t border-line-subtle px-4 py-2">
                <Button
                  onClick={() => setShowAllHistory((current) => !current)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {showAllHistory ? 'Show fewer' : `Show all ${history.length}`}
                </Button>
              </div>
            ) : null}
          </Card>
        )}
      </section>

      {vehicle ? (
        <>
          <TyreSetupDialog
            catalogSize={catalogTyreSize}
            onOpenChange={(open) => setOpenDialog(open ? 'setup' : null)}
            open={openDialog === 'setup'}
            vehicleId={vehicle.id}
            vehicleOdometer={vehicle.odometer}
            vehicleType={vehicle.vehicleType}
          />
          <TyreFormDialog
            defaultSize={catalogTyreSize}
            isOpen={openDialog === 'tyre'}
            onClose={() => setOpenDialog(null)}
            vehicleId={vehicle.id}
            vehicleOdometer={vehicle.odometer}
            vehicleType={vehicle.vehicleType}
          />
          <TyreInspectionDialog
            isOpen={openDialog === 'inspection'}
            onClose={() => setOpenDialog(null)}
            tyres={tyres}
            vehicleId={vehicle.id}
            vehicleOdometer={vehicle.odometer}
          />
          {editTarget ? (
            <TyreFormDialog
              isOpen={isEditOpen}
              onClose={() => setIsEditOpen(false)}
              tyre={editTarget}
              vehicleId={vehicle.id}
              vehicleOdometer={vehicle.odometer}
              vehicleType={vehicle.vehicleType}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const LEVEL_APPEARANCE: Record<
  TyreConditionLevel,
  { icon: typeof ShieldCheck; text: string; ring: string; tint: string }
> = {
  illegal: { icon: AlertCircle, text: 'text-late', ring: 'border-late', tint: 'bg-late-tint' },
  replace: { icon: AlertCircle, text: 'text-late', ring: 'border-late/60', tint: 'bg-late-tint' },
  warn: { icon: Clock, text: 'text-soon', ring: 'border-soon/60', tint: 'bg-soon-tint' },
  healthy: { icon: ShieldCheck, text: 'text-ok', ring: 'border-ok/50', tint: 'bg-surface' },
  unknown: {
    icon: HelpCircle,
    text: 'text-fg-3',
    ring: 'border-line border-dashed',
    tint: 'bg-surface',
  },
};

function VerdictLine({ verdict }: { verdict: NonNullable<ReturnType<typeof tyreVerdict>> }) {
  const appearance = LEVEL_APPEARANCE[verdict.level];
  const Icon = appearance.icon;

  return (
    <p
      className="flex items-start gap-2 text-lead font-semibold text-fg"
      data-level={verdict.level}
      data-testid="tyre-verdict"
    >
      <Icon aria-hidden="true" className={cn('mt-1 size-5 shrink-0', appearance.text)} />
      <span>{verdict.text}</span>
    </p>
  );
}

function SizeLine({ size }: { size: string }) {
  return (
    <p className="mt-1 text-small text-fg-2" data-testid="catalog-tyre-size">
      Size for this variant: <span className="font-semibold text-fg">{size}</span>
    </p>
  );
}

/** "Michelin Primacy 4 · 205/55 R16 · DOT 3624": what is written on the tyre. */
function describeTyre(tyre: Tyre): string | null {
  const name = [tyre.brand, tyre.model].filter(Boolean).join(' ');
  const dot = formatDotCode(tyre.dotWeek ?? null, tyre.dotYear ?? null);

  return [name, tyre.size, dot ? `DOT ${dot}` : null].filter(Boolean).join(' · ') || null;
}

/** Screen order for a car: front pair, then rear pair; the spare sits below. */
const FOUR_WHEEL_ORDER = [
  TyrePosition.FrontLeft,
  TyrePosition.FrontRight,
  TyrePosition.RearLeft,
  TyrePosition.RearRight,
];
const TWO_WHEEL_ORDER = [TyrePosition.Front, TyrePosition.Rear];

/**
 * The wheels where they sit on the vehicle: a car's four around its body, a
 * two-wheeler's front over rear. Each carries its tread and age in words, so
 * the diagram reads without colour. The spare, if tracked, sits below.
 */
function WheelDiagram({
  conditions,
  twoWheeler,
  tyreById,
  readingsByTyre,
  onEdit,
  onDelete,
  deletingId,
}: {
  conditions: TyreCondition[];
  twoWheeler: boolean;
  tyreById: Map<string, Tyre>;
  readingsByTyre: Map<string, TyreInspection[]>;
  onEdit?: (tyre: Tyre) => void;
  onDelete?: (tyre: Tyre) => Promise<void>;
  deletingId: string | null;
}) {
  const byPosition = new Map(conditions.map((condition) => [condition.position, condition]));
  const order = twoWheeler ? TWO_WHEEL_ORDER : FOUR_WHEEL_ORDER;
  const spare = byPosition.get(TyrePosition.Spare);
  const description = conditions
    .map(
      (condition) =>
        `${format.enumLabel('tyrePosition', condition.position)}: ${wheelReading(condition)}, ${LEVEL_WORDS[condition.level].toLowerCase()}.`,
    )
    .join(' ');

  const wheel = (position: TyrePosition) => {
    const condition = byPosition.get(position);
    const tyre = condition ? tyreById.get(condition.tyreId) : undefined;
    return (
      <WheelTile
        condition={condition ?? null}
        isDeleting={Boolean(tyre && deletingId === tyre.id)}
        key={position}
        onDelete={onDelete && tyre ? () => onDelete(tyre) : undefined}
        onEdit={onEdit && tyre ? () => onEdit(tyre) : undefined}
        position={position}
        readingCount={tyre ? (readingsByTyre.get(tyre.id)?.length ?? 0) : 0}
        tyre={tyre ?? null}
      />
    );
  };

  return (
    <figure
      aria-label={`Wheel diagram. ${description}`}
      className="max-w-3xl space-y-3"
      data-testid="wheel-diagram"
    >
      <div
        className={cn(
          'relative grid gap-3',
          twoWheeler ? 'mx-auto max-w-sm grid-cols-1' : 'grid-cols-2',
        )}
      >
        {/* The body the wheels hang off: decoration only. */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute border-2 border-line bg-page/60',
            twoWheeler
              ? 'inset-y-6 left-1/2 w-2 -translate-x-1/2 rounded-full'
              : 'inset-x-1/4 inset-y-6 rounded-[2rem]',
          )}
        />
        {order.map(wheel)}
      </div>
      {spare ? <div className="max-w-sm">{wheel(TyrePosition.Spare)}</div> : null}
    </figure>
  );
}

function WheelTile({
  position,
  condition,
  tyre,
  readingCount,
  onEdit,
  onDelete,
  isDeleting,
}: {
  position: TyrePosition;
  condition: TyreCondition | null;
  tyre: Tyre | null;
  readingCount: number;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  isDeleting: boolean;
}) {
  const label = format.enumLabel('tyrePosition', position);
  const level = condition?.level ?? 'unknown';
  const appearance = LEVEL_APPEARANCE[level];
  const Icon = appearance.icon;
  const written = tyre ? describeTyre(tyre) : null;

  return (
    <div
      className={cn('relative rounded-card border-2 p-4', appearance.ring, appearance.tint)}
      data-level={level}
      data-testid="tyre-corner"
    >
      <p className="text-small font-semibold text-fg-2">{label}</p>
      {condition ? (
        <>
          <p className="mt-0.5 text-body font-semibold tabular-nums text-fg">
            {wheelReading(condition)}
          </p>
          <p
            className={cn(
              'mt-1 flex items-center gap-1.5 text-small font-semibold',
              appearance.text,
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {LEVEL_WORDS[level]}
          </p>
          {condition.estimatedKmRemaining != null ? (
            <p className="mt-1 text-small text-fg-3">
              ~{format.distance(condition.estimatedKmRemaining)} left at this wear
            </p>
          ) : null}
          {written ? <p className="mt-1 text-small text-fg-3">{written}</p> : null}
        </>
      ) : (
        <p className="mt-0.5 text-small text-fg-3">No tyre on file</p>
      )}
      {onEdit || onDelete ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {onEdit ? (
            <Button
              aria-label={`Edit the ${label.toLowerCase()} tyre`}
              onClick={onEdit}
              size="sm"
              type="button"
              variant="ghost"
            >
              Edit
            </Button>
          ) : null}
          {onDelete ? (
            <ConfirmActionDialog
              confirmLabel="Delete tyre"
              description={`${
                readingCount > 0
                  ? `Its ${readingCount} reading${readingCount === 1 ? '' : 's'} will be deleted with it.`
                  : 'It has no readings yet.'
              } If it was replaced, add the new tyre instead: that keeps this one's history. This cannot be undone.`}
              isPending={isDeleting}
              onConfirm={onDelete}
              title={`Delete the ${label.toLowerCase()} tyre?`}
              triggerLabel="Delete"
              triggerVariant="ghost"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_WORDS: Record<TyreStatus, string> = {
  healthy: 'Healthy',
  due: 'Due soon',
  overdue: 'Overdue',
  unknown: 'Not tracked',
};

/** Says where the interval came from, so a vehicle-specific figure is visibly not a guess. */
const INTERVAL_SOURCE_NOTE: Record<TyreMetric['intervalSource'], string | null> = {
  workshop: ' · per workshop',
  variant: ' · per manufacturer',
  default: null,
  fallback: null,
};

/** The same number means different things depending on what it was measured from. */
function describeBaseline(metric: TyreMetric): string {
  switch (metric.origin) {
    case 'record':
      return `since last ${metric.category === 'wheel_alignment' ? 'alignment' : 'service'}`;
    case 'new':
      return 'since new — none logged yet';
    case 'purchase':
      return 'since purchase — earlier history unknown';
    case 'none':
      return 'No service logged yet';
  }
}

/** One service on the rotation/alignment clock: how far since, and how far to go. */
function MetricRow({ label, metric }: { label: string; metric: TyreMetric }) {
  const tone = {
    healthy: 'text-ok',
    due: 'text-soon',
    overdue: 'text-late',
    unknown: 'text-fg-3',
  }[metric.status];

  return (
    <div className="px-4 py-3" data-testid="tyre-service">
      <p className="flex flex-wrap items-center gap-x-2 text-body font-semibold text-fg">
        <Wrench aria-hidden="true" className="size-4 text-fg-3" />
        {label}
        <span className={cn('text-small font-semibold', tone)}>{STATUS_WORDS[metric.status]}</span>
      </p>
      <p className="text-small text-fg-2">
        {metric.origin === 'none' ? null : `${format.distance(metric.kmSince)} `}
        <span>{describeBaseline(metric)}</span>
        {metric.status !== 'unknown' && metric.kmRemaining !== null ? (
          <>
            {' · '}
            <span>
              {metric.kmRemaining >= 0
                ? `${format.distance(metric.kmRemaining)} to go`
                : `${format.distance(Math.abs(metric.kmRemaining))} past due`}
            </span>
            {INTERVAL_SOURCE_NOTE[metric.intervalSource]}
          </>
        ) : null}
      </p>
    </div>
  );
}

function HistoryItem({ item }: { item: TyreHistoryItem }) {
  const body = (
    <>
      <p className="font-semibold text-fg [overflow-wrap:anywhere]">{item.title}</p>
      <p className="text-small text-fg-2">{item.details.join(' · ')}</p>
    </>
  );

  return (
    <li data-kind={item.kind} data-testid="tyre-history-item">
      {item.recordId ? (
        <Link
          className="block px-4 py-3 hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          params={{ recordId: item.recordId }}
          to="/maintenance-records/$recordId"
        >
          {body}
        </Link>
      ) : (
        <div className="px-4 py-3">{body}</div>
      )}
    </li>
  );
}
