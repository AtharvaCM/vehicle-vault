import { useMemo, useState } from 'react';
import {
  RotateCw,
  Settings2,
  ShieldCheck,
  AlertCircle,
  Clock,
  HelpCircle,
  Plus,
  ClipboardCheck,
  Gauge,
} from 'lucide-react';
import {
  TyrePosition,
  type MaintenanceRecord,
  type TyreCondition,
  type TyreConditionLevel,
  type Vehicle,
} from '@vehicle-vault/shared';
import { formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, EmptyStateAction } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils/cn';

import type { useMaintenanceRecords } from '../../maintenance/hooks/use-maintenance-records';
import { TyreFormDialog } from '../../tyres/components/tyre-form-dialog';
import { TyreInspectionDialog } from '../../tyres/components/tyre-inspection-dialog';
import { useVehicleTyreCondition, useVehicleTyres } from '../../tyres/hooks/use-tyres';
import { useVehicleIntervals } from '../hooks/use-vehicle-intervals';
import { getTyreInsights, type TyreMetric, type TyreStatus } from '../utils/get-tyre-status';

interface VehicleTyreTrackerProps {
  vehicle: Vehicle | null;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
}

export function VehicleTyreTracker({ vehicle, maintenanceQuery }: VehicleTyreTrackerProps) {
  const records = useMemo<MaintenanceRecord[]>(
    () => maintenanceQuery.data ?? [],
    [maintenanceQuery.data],
  );

  // The API resolves these per vehicle, using catalog data when the vehicle is
  // linked to a variant. Deciding an interval here instead would put this tab
  // and the alert engine into open disagreement about the same vehicle.
  const intervalsQuery = useVehicleIntervals(vehicle?.id ?? '');

  // Measured per-corner condition. Where this exists it outranks every
  // service-interval inference: tread depth and manufacture age are the facts
  // that decide whether a tyre is safe, and neither can be derived from dates.
  const conditionQuery = useVehicleTyreCondition(vehicle?.id ?? '');
  const tyresQuery = useVehicleTyres(vehicle?.id ?? '');

  const [openDialog, setOpenDialog] = useState<'tyre' | 'inspection' | null>(null);

  const insights = useMemo(
    () => getTyreInsights({ vehicle, records, intervals: intervalsQuery.data }),
    [vehicle, records, intervalsQuery.data],
  );

  // Tyre history is derived entirely from maintenance records; without this the
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
  const hasMeasurements = measured.length > 0;
  const serviceStatus = mergeStatus(insights.rotation.status, insights.alignment.status);
  const byPosition = new Map(measured.map((tyre) => [tyre.position, tyre]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <div className="space-y-6">
        <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold">Wheel &amp; Tyre Geometry</CardTitle>
                <CardDescription>
                  {hasMeasurements
                    ? 'Per-corner condition from recorded tread depth and tyre age.'
                    : 'Derived from logged service history. Add tyres to track tread and age.'}
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-white font-bold tracking-tight uppercase text-[10px]"
                >
                  {hasMeasurements
                    ? CONDITION_COPY[conditionQuery.data?.overall ?? 'unknown'].label
                    : STATUS_COPY[serviceStatus].label}
                </Badge>
                <Button onClick={() => setOpenDialog('tyre')} size="sm" variant="secondary">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add tyre
                </Button>
                <Button
                  onClick={() => setOpenDialog('inspection')}
                  size="sm"
                  variant="secondary"
                >
                  <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                  Log inspection
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 sm:p-12">
            <div
              aria-label={describeDiagram(insights, measured, hasMeasurements)}
              className="relative mx-auto flex aspect-[1/2] w-full max-w-[180px] items-center justify-center rounded-[40px] border-2 border-slate-200 bg-slate-50/30"
              role="img"
            >
              {/* Horizontal axles */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-slate-200" />
              <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-slate-200" />

              {/*
                Each corner now shows its own measured condition. Without
                measurements they fall back to one shared service-derived status,
                because rotation is a four-wheel operation and alignment is axle
                geometry — neither describes an individual tyre.
              */}
              {DIAGRAM_CORNERS.map(({ corner, position }) => (
                <TyreGlyph
                  key={corner}
                  corner={corner}
                  measured={byPosition.get(position) ?? null}
                  status={hasMeasurements ? null : serviceStatus}
                />
              ))}

              <div className="w-1/2 h-2/3 border border-slate-200/50 rounded-2xl flex items-center justify-center">
                <div className="text-[10px] font-black text-slate-300 uppercase rotate-90">
                  Chassis
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasMeasurements ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {measured.map((tyre) => (
              <CornerCard key={tyre.tyreId} tyre={tyre} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              <EmptyStateAction onClick={() => setOpenDialog('tyre')} size="sm">
                Add a tyre
              </EmptyStateAction>
            }
            description="Tread depth and manufacture date decide whether a tyre is safe, and neither can be inferred from service dates. Add your tyres to track them per corner."
            icon={Gauge}
            title="No tyres tracked yet"
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            icon={<RotateCw className="h-4 w-4" />}
            label="Tyre Rotation"
            metric={insights.rotation}
          />
          <MetricCard
            icon={<Settings2 className="h-4 w-4" />}
            label="Wheel Alignment"
            metric={insights.alignment}
          />
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-200/60 bg-white shadow-premium-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Tyre Records</CardTitle>
            <CardDescription>
              Rotations, alignments, replacements and punctures.
              {insights.records.length > TYRE_RECORD_PREVIEW
                ? ` Showing ${TYRE_RECORD_PREVIEW} of ${insights.records.length}.`
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.records.slice(0, TYRE_RECORD_PREVIEW).map((record) => (
              <div
                key={record.id}
                className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-tight text-slate-900">
                    {formatCategory(record.category)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(record.serviceDate).toLocaleDateString()} •{' '}
                    {record.odometer.toLocaleString()} km
                  </p>
                </div>
              </div>
            ))}
            {insights.records.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                No tyre records found.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {insights.lastReplacement ? (
          <Card className="border-slate-200/60 bg-white shadow-premium-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Current Tyres</CardTitle>
              <CardDescription>Fitted at the last recorded replacement.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black tracking-tighter text-slate-900">
                {insights.lastReplacement.odometer.toLocaleString()} km
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                fitted {new Date(insights.lastReplacement.serviceDate).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {vehicle ? (
        <>
          <TyreFormDialog
            isOpen={openDialog === 'tyre'}
            onClose={() => setOpenDialog(null)}
            vehicleId={vehicle.id}
            vehicleOdometer={vehicle.odometer}
          />
          <TyreInspectionDialog
            isOpen={openDialog === 'inspection'}
            onClose={() => setOpenDialog(null)}
            tyres={tyresQuery.data ?? []}
            vehicleId={vehicle.id}
            vehicleOdometer={vehicle.odometer}
          />
        </>
      ) : null}
    </div>
  );
}

const TYRE_RECORD_PREVIEW = 5;

/** Says where the interval came from, so a vehicle-specific figure is visibly not a guess. */
const INTERVAL_SOURCE_NOTE: Record<TyreMetric['intervalSource'], string | null> = {
  workshop: ' • per workshop',
  variant: ' • per manufacturer',
  default: null,
  fallback: null,
};

/** Screen position -> the tyre actually fitted there. The spare has no corner on the diagram. */
const DIAGRAM_CORNERS = [
  { corner: 'top-left' as const, position: TyrePosition.FrontLeft },
  { corner: 'top-right' as const, position: TyrePosition.FrontRight },
  { corner: 'bottom-left' as const, position: TyrePosition.RearLeft },
  { corner: 'bottom-right' as const, position: TyrePosition.RearRight },
];

const CONDITION_COPY: Record<
  TyreConditionLevel,
  { label: string; icon: typeof ShieldCheck; border: string; icons: string; card: string }
> = {
  illegal: {
    label: 'Not roadworthy',
    icon: AlertCircle,
    border: 'border-rose-600',
    icons: 'text-rose-500',
    card: 'bg-rose-50 border-rose-200',
  },
  replace: {
    label: 'Replace',
    icon: AlertCircle,
    border: 'border-rose-500/60',
    icons: 'text-rose-500',
    card: 'bg-rose-50 border-rose-100',
  },
  warn: {
    label: 'Wearing',
    icon: Clock,
    border: 'border-orange-500/60',
    icons: 'text-orange-500',
    card: 'bg-orange-50 border-orange-100',
  },
  healthy: {
    label: 'Healthy',
    icon: ShieldCheck,
    border: 'border-emerald-500/50',
    icons: 'text-emerald-500',
    card: 'bg-emerald-50 border-emerald-100',
  },
  unknown: {
    label: 'Not measured',
    icon: HelpCircle,
    border: 'border-slate-400/40 border-dashed',
    icons: 'text-slate-400',
    card: 'bg-slate-50 border-slate-200',
  },
};

const POSITION_LABEL: Record<TyrePosition, string> = {
  [TyrePosition.FrontLeft]: 'Front left',
  [TyrePosition.FrontRight]: 'Front right',
  [TyrePosition.RearLeft]: 'Rear left',
  [TyrePosition.RearRight]: 'Rear right',
  [TyrePosition.Spare]: 'Spare',
};

/**
 * The diagram is the whole point of the tab, so its text alternative has to
 * carry the same information rather than just naming a colour.
 */
function describeDiagram(
  insights: ReturnType<typeof getTyreInsights>,
  measured: TyreCondition[],
  hasMeasurements: boolean,
): string {
  if (!hasMeasurements) {
    return (
      `Wheel diagram. Tyre rotation: ${STATUS_COPY[insights.rotation.status].label}. ` +
      `Wheel alignment: ${STATUS_COPY[insights.alignment.status].label}. ` +
      'Individual tyre condition is not tracked.'
    );
  }

  const corners = measured
    .map((tyre) => `${POSITION_LABEL[tyre.position]}: ${tyre.summary}`)
    .join(' ');

  return `Wheel diagram showing measured tyre condition. ${corners}`;
}

const STATUS_COPY: Record<TyreStatus, { label: string; icon: typeof ShieldCheck }> = {
  healthy: { label: 'Healthy', icon: ShieldCheck },
  due: { label: 'Due soon', icon: Clock },
  overdue: { label: 'Overdue', icon: AlertCircle },
  unknown: { label: 'Not tracked', icon: HelpCircle },
};

/** The diagram shows one condition for the whole vehicle, so the worst applicable state wins. */
function mergeStatus(...statuses: TyreStatus[]): TyreStatus {
  const rank: Record<TyreStatus, number> = { overdue: 0, due: 1, unknown: 2, healthy: 3 };
  return statuses.reduce((worst, next) => (rank[next] < rank[worst] ? next : worst));
}

function formatCategory(category: string) {
  return category.replaceAll('_', ' ');
}

interface TyreGlyphProps {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Measured condition when the tyre is tracked. */
  measured: TyreCondition | null;
  /** Service-derived fallback, used only when nothing is measured. */
  status: TyreStatus | null;
}

function TyreGlyph({ corner, measured, status }: TyreGlyphProps) {
  const posClasses = {
    'top-left': '-top-4 -left-8 sm:-left-10',
    'top-right': '-top-4 -right-8 sm:-right-10',
    'bottom-left': '-bottom-4 -left-8 sm:-left-10',
    'bottom-right': '-bottom-4 -right-8 sm:-right-10',
  }[corner];

  const appearance = measured
    ? CONDITION_COPY[measured.level]
    : CONDITION_COPY[status ? SERVICE_TO_CONDITION[status] : 'unknown'];

  const Icon = appearance.icon;

  return (
    // The wrapper carries the positioning so the depth label can sit outside the
    // tread box, which clips its own overflow.
    <div aria-hidden="true" className={cn('absolute flex flex-col items-center', posClasses)}>
      <div
        className={cn(
          'flex h-20 w-11 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border-2 bg-slate-900 shadow-premium-md',
          appearance.border,
        )}
      >
        {/* Decorative tread lines; the depth figure below is the measured one. */}
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-px w-full bg-slate-800" />
        ))}
        <Icon className={cn('absolute h-3 w-3', appearance.icons)} />
      </div>
      {measured?.treadDepthMm != null ? (
        <span className="mt-1 text-[9px] font-black tabular-nums text-slate-500">
          {measured.treadDepthMm.toFixed(1)}mm
        </span>
      ) : null}
    </div>
  );
}

/** Maps a service-schedule verdict onto the condition palette when nothing is measured. */
const SERVICE_TO_CONDITION: Record<TyreStatus, TyreConditionLevel> = {
  healthy: 'healthy',
  due: 'warn',
  overdue: 'replace',
  unknown: 'unknown',
};

interface CornerCardProps {
  tyre: TyreCondition;
}

/** One measured corner: what it reads, why that matters, and how long it has left. */
function CornerCard({ tyre }: CornerCardProps) {
  const appearance = CONDITION_COPY[tyre.level];
  const Icon = appearance.icon;

  return (
    <div className={cn('rounded-2xl border p-5 shadow-premium-sm', appearance.card)}>
      <div className="mb-3 flex items-center justify-between">
        <div className={cn('rounded-xl bg-white p-2 shadow-sm', appearance.icons)}>
          <Icon className="h-4 w-4" />
        </div>
        <Badge
          variant="outline"
          className="bg-white text-[9px] font-black uppercase tracking-wider"
        >
          {appearance.label}
        </Badge>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {POSITION_LABEL[tyre.position]}
      </p>
      <p className="mt-1 text-2xl font-black tracking-tighter tabular-nums text-slate-900">
        {tyre.treadDepthMm != null ? `${tyre.treadDepthMm.toFixed(1)} mm` : '—'}
      </p>
      <p className="mt-1 text-[11px] font-medium leading-4 text-slate-600">{tyre.summary}</p>
      <div className="mt-2 space-y-0.5">
        {tyre.estimatedKmRemaining != null ? (
          <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">
            ~{tyre.estimatedKmRemaining.toLocaleString()} km left at current wear
          </p>
        ) : null}
        {tyre.lastInspectedAt ? (
          <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">
            Checked {formatDistanceToNow(new Date(tyre.lastInspectedAt), { addSuffix: true })}
          </p>
        ) : (
          <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">
            Never inspected
          </p>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  metric: TyreMetric;
}

function MetricCard({ icon, label, metric }: MetricCardProps) {
  const cardClasses = {
    healthy: 'bg-emerald-50 border-emerald-100',
    due: 'bg-orange-50 border-orange-100',
    overdue: 'bg-rose-50 border-rose-100',
    unknown: 'bg-slate-50 border-slate-200',
  }[metric.status];

  const iconClasses = {
    healthy: 'text-emerald-600',
    due: 'text-orange-600',
    overdue: 'text-rose-600',
    unknown: 'text-slate-500',
  }[metric.status];

  return (
    <div className={cn('rounded-2xl border p-5 shadow-premium-sm transition-all', cardClasses)}>
      <div className="mb-3 flex items-center justify-between">
        <div className={cn('rounded-xl bg-white p-2 shadow-sm', iconClasses)}>{icon}</div>
        <Badge
          variant="outline"
          className="bg-white text-[9px] font-black uppercase tracking-wider"
        >
          {STATUS_COPY[metric.status].label}
        </Badge>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tighter text-slate-900">
          {metric.kmSince === null ? '—' : `${metric.kmSince.toLocaleString()} km`}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">{describeBaseline(metric)}</p>
        {metric.lastRecord ? (
          <p className="mt-2 text-[9px] font-bold uppercase tracking-tighter text-slate-400">
            Last: {formatDistanceToNow(new Date(metric.lastRecord.serviceDate), { addSuffix: true })}
          </p>
        ) : null}
        {metric.status !== 'unknown' && metric.kmRemaining !== null ? (
          <p className="mt-2 text-[9px] font-bold uppercase tracking-tighter text-slate-400">
            {metric.kmRemaining >= 0
              ? `${metric.kmRemaining.toLocaleString()} km to go`
              : `${Math.abs(metric.kmRemaining).toLocaleString()} km past due`}
            {INTERVAL_SOURCE_NOTE[metric.intervalSource]}
          </p>
        ) : null}
      </div>
    </div>
  );
}

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
      return 'no service logged yet';
  }
}
