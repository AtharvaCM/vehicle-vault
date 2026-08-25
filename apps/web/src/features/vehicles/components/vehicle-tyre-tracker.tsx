import { useMemo } from 'react';
import { RotateCw, Settings2, ShieldCheck, AlertCircle, Clock, HelpCircle } from 'lucide-react';
import type { MaintenanceRecord, Vehicle } from '@vehicle-vault/shared';
import { formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { cn } from '@/lib/utils/cn';

import type { useMaintenanceRecords } from '../../maintenance/hooks/use-maintenance-records';
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

  const overallStatus = mergeStatus(insights.rotation.status, insights.alignment.status);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <div className="space-y-6">
        <Card className="border-slate-200/60 bg-white shadow-premium-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold">Wheel &amp; Tyre Geometry</CardTitle>
                <CardDescription>
                  Derived from logged service history. Tread and pressure are not measured.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-white font-bold tracking-tight uppercase text-[10px] shrink-0"
              >
                {STATUS_COPY[overallStatus].label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 sm:p-12">
            <div
              aria-label={`Wheel diagram. Tyre rotation: ${STATUS_COPY[insights.rotation.status].label}. Wheel alignment: ${STATUS_COPY[insights.alignment.status].label}. Individual tyre condition is not tracked.`}
              className="relative mx-auto flex aspect-[1/2] w-full max-w-[180px] items-center justify-center rounded-[40px] border-2 border-slate-200 bg-slate-50/30"
              role="img"
            >
              {/* Horizontal axles */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-slate-200" />
              <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-slate-200" />

              {/*
                All four corners share one status. Rotation is a four-wheel
                operation and alignment is axle geometry, so neither describes an
                individual tyre — and no per-corner tread data exists to colour
                them separately.
              */}
              <TyreGlyph position="top-left" status={overallStatus} />
              <TyreGlyph position="top-right" status={overallStatus} />
              <TyreGlyph position="bottom-left" status={overallStatus} />
              <TyreGlyph position="bottom-right" status={overallStatus} />

              <div className="w-1/2 h-2/3 border border-slate-200/50 rounded-2xl flex items-center justify-center">
                <div className="text-[10px] font-black text-slate-300 uppercase rotate-90">
                  Chassis
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  status: TyreStatus;
}

function TyreGlyph({ position, status }: TyreGlyphProps) {
  const posClasses = {
    'top-left': '-top-4 -left-8 sm:-left-10',
    'top-right': '-top-4 -right-8 sm:-right-10',
    'bottom-left': '-bottom-4 -left-8 sm:-left-10',
    'bottom-right': '-bottom-4 -right-8 sm:-right-10',
  }[position];

  const statusClasses = {
    healthy: 'border-emerald-500/50',
    due: 'border-orange-500/50',
    overdue: 'border-rose-500/50',
    unknown: 'border-slate-400/40 border-dashed',
  }[status];

  const iconClasses = {
    healthy: 'text-emerald-500',
    due: 'text-orange-500',
    overdue: 'text-rose-500',
    unknown: 'text-slate-400',
  }[status];

  const Icon = STATUS_COPY[status].icon;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute flex h-20 w-11 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border-2 bg-slate-900 shadow-premium-md',
        posClasses,
        statusClasses,
      )}
    >
      {/* Decorative tread lines — the app does not measure tread depth. */}
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-px w-full bg-slate-800" />
      ))}
      <Icon className={cn('absolute h-3 w-3', iconClasses)} />
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
