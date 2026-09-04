import { Link } from '@tanstack/react-router';
import { BellRing, CarFront, MoreHorizontal, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { VehicleType } from '@vehicle-vault/shared';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format-date';

import type { DashboardVehicleHealth } from '../types/dashboard';
import type { VehicleDetailTab } from '@/features/vehicles/types/vehicle-detail-search';
import { describeVehicleDocuments } from '../utils/describe-vehicle-documents';
import {
  formatKm,
  formatOdometerMeta,
  formatRelativeAgo,
  formatRelativeDue,
} from '../utils/format-due';

const FOUR_WHEELER_TYPES: readonly string[] = [
  VehicleType.Car,
  VehicleType.SUV,
  VehicleType.Truck,
  VehicleType.Van,
];

const DOCUMENT_TONE = {
  danger: 'text-rose-600',
  warning: 'text-amber-700',
  ok: 'text-slate-700',
} as const;

type VehicleHealthCardProps = {
  vehicle: DashboardVehicleHealth;
  /** Injectable for deterministic document day math in tests. */
  today?: Date;
};

type MicroRowProps = {
  label: string;
  children: ReactNode;
};

function MicroRow({ label, children }: MicroRowProps) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="min-w-0 truncate text-[12px] font-medium text-slate-700">{children}</div>
    </div>
  );
}

function nextDueText(nextDue: NonNullable<DashboardVehicleHealth['nextDue']>) {
  if (nextDue.dueDate) {
    const relative = formatRelativeDue({
      kind: nextDue.kind,
      daysUntilDue: nextDue.daysUntilDue,
      dueDate: nextDue.dueDate,
      dueOdometer: nextDue.dueOdometer,
    });

    // An odometer-triggered reminder can be overdue while its date is weeks away; keep the
    // km target visible so the status pill always has a visible cause.
    return nextDue.dueOdometer !== undefined
      ? `${nextDue.title} · ${relative} · ${formatOdometerMeta(nextDue.dueOdometer)}`
      : `${nextDue.title} · ${relative}`;
  }

  if (nextDue.dueOdometer !== undefined) {
    return `${nextDue.title} · ${formatOdometerMeta(nextDue.dueOdometer)}`;
  }

  return nextDue.title;
}

export function VehicleHealthCard({ vehicle, today }: VehicleHealthCardProps) {
  const canEdit = vehicle.currentUserRole !== 'viewer';
  const documents = describeVehicleDocuments(vehicle.documents, today);
  const statusTab: VehicleDetailTab | undefined =
    vehicle.status === 'ok' || !vehicle.nextDue
      ? undefined
      : vehicle.nextDue.kind === 'document'
        ? 'protection'
        : 'reminders';
  const kmSinceService = vehicle.lastService ? vehicle.odometer - vehicle.lastService.odometer : 0;

  return (
    <Card
      className={cn(
        'flex flex-col gap-3 border-slate-200/60 bg-white/70 shadow-premium-sm transition-colors hover:bg-white',
        vehicle.status === 'overdue' && 'border-rose-200/60',
        vehicle.status === 'due_soon' && 'border-amber-200/60',
      )}
      data-testid="vehicle-health-card"
      size="sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 shadow-inner">
          {FOUR_WHEELER_TYPES.includes(vehicle.vehicleType) ? (
            <CarFront aria-hidden="true" className="h-5 w-5" />
          ) : (
            <span aria-hidden="true" className="text-xs font-bold">
              M/C
            </span>
          )}
        </div>

        <Link
          className="group min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          params={{ vehicleId: vehicle.id }}
          to="/vehicles/$vehicleId"
        >
          <p className="truncate font-bold text-slate-900 transition-colors group-hover:text-primary">
            {vehicle.displayName}
          </p>
          <p className="truncate text-[12px] tabular-nums text-slate-500">
            {vehicle.registrationNumber}
          </p>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            asChild
            tone={
              vehicle.status === 'overdue'
                ? 'danger'
                : vehicle.status === 'due_soon'
                  ? 'warning'
                  : 'accent'
            }
          >
            <Link
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              params={{ vehicleId: vehicle.id }}
              search={statusTab ? { tab: statusTab } : {}}
              to="/vehicles/$vehicleId"
            >
              {vehicle.status === 'overdue'
                ? `${vehicle.overdueCount} overdue`
                : vehicle.status === 'due_soon'
                  ? `${vehicle.dueSoonCount} due soon`
                  : 'All clear'}
            </Link>
          </Badge>
          {vehicle.currentUserRole !== 'owner' ? (
            <Badge className="bg-blue-100 text-blue-800">Shared · {vehicle.currentUserRole}</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2.5">
        <MicroRow label="Next due">
          {vehicle.nextDue ? (
            nextDueText(vehicle.nextDue)
          ) : (
            <span className="text-slate-400">Nothing scheduled</span>
          )}
        </MicroRow>
        <MicroRow label="Documents">
          <Link
            className={cn(
              'rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              DOCUMENT_TONE[documents.tone],
            )}
            params={{ vehicleId: vehicle.id }}
            search={{ tab: 'protection' }}
            to="/vehicles/$vehicleId"
          >
            {documents.text}
          </Link>
        </MicroRow>
        <MicroRow label="Last service">
          {vehicle.lastService ? (
            <Link
              className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              params={{ recordId: vehicle.lastService.recordId }}
              to="/maintenance-records/$recordId"
            >
              Serviced {formatDate(vehicle.lastService.serviceDate)}
              {kmSinceService > 0 ? ` · ${formatKm(kmSinceService)} ago` : ''}
            </Link>
          ) : (
            <span className="text-slate-400">No service logged</span>
          )}
        </MicroRow>
        <MicroRow label="Odometer">
          <Link
            className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            params={{ vehicleId: vehicle.id }}
            to="/vehicles/$vehicleId/edit"
          >
            Updated {formatRelativeAgo(vehicle.odometerUpdatedAt, today)} · Update
          </Link>
        </MicroRow>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-slate-500">
          {formatKm(vehicle.odometer)}
        </span>
        <div className="flex items-center gap-1.5">
          {canEdit ? (
            <>
              <Link
                aria-label={`Log service for ${vehicle.displayName}`}
                className={buttonVariants({ size: 'xs', variant: 'outline' })}
                params={{ vehicleId: vehicle.id }}
                to="/vehicles/$vehicleId/maintenance/new"
              >
                <Wrench aria-hidden="true" />
                <span className="hidden sm:inline">Log service</span>
              </Link>
              <Link
                aria-label={`Add reminder for ${vehicle.displayName}`}
                className={buttonVariants({ size: 'xs', variant: 'outline' })}
                params={{ vehicleId: vehicle.id }}
                to="/vehicles/$vehicleId/reminders/new"
              >
                <BellRing aria-hidden="true" />
                <span className="hidden sm:inline">Reminder</span>
              </Link>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`More actions for ${vehicle.displayName}`}
                className="h-7 w-7"
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'fuel' }}
                  to="/vehicles/$vehicleId"
                >
                  Add fuel
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'protection' }}
                  to="/vehicles/$vehicleId"
                >
                  Documents
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  params={{ vehicleId: vehicle.id }}
                  to="/vehicles/$vehicleId/reminders"
                >
                  All reminders
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
