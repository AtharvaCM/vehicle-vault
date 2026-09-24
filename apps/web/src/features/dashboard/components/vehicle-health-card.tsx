import { Link } from '@tanstack/react-router';
import { BellRing, Bike, CarFront, MoreHorizontal, Wrench } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import type { DashboardDataGap, DashboardVehicleHealth } from '../types/dashboard';
import type { VehicleDetailTab } from '@/features/vehicles/types/vehicle-detail-search';
import { format } from '@/lib/format';
import { ATTENTION_KIND_TABS } from '../utils/attention-kind-tab';
import { describeVehicleDocuments } from '../utils/describe-vehicle-documents';
import { OdometerQuickUpdate } from './odometer-quick-update';
import { formatOdometerMeta, formatRelativeAgo, formatRelativeDue } from '../utils/format-due';

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

/**
 * How each gap in the vehicle's data reads, and where it is filled. The
 * odometer has no link: its Update control is on the card itself.
 */
const DATA_GAPS: Record<
  DashboardDataGap,
  { text: string; fill: VehicleDetailTab | 'edit' | null }
> = {
  service_history: { text: 'Service history incomplete', fill: 'maintenance' },
  odometer: { text: 'Odometer not updated lately', fill: null },
  insurance: { text: 'No current insurance', fill: 'protection' },
  catalog_link: { text: 'Not linked to a catalog model', fill: 'edit' },
  puc: { text: 'No current PUC', fill: 'protection' },
  tyres: { text: 'Tyres not tracked', fill: 'tyres' },
  purchase_price: { text: 'No purchase price', fill: 'edit' },
};

const INLINE_LINK =
  'rounded-sm hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring';

/** The score, and the one gap worth filling next: linked for someone who can fill it. */
function DataHealthText({
  vehicle,
  canEdit,
}: {
  vehicle: DashboardVehicleHealth;
  canEdit: boolean;
}) {
  const health = vehicle.dataHealth;
  if (!health) return null;

  if (health.nextGap === null) {
    return <span className="text-emerald-700">Complete</span>;
  }

  const { text, fill } = DATA_GAPS[health.nextGap];
  let gap: ReactNode = <span>{text}</span>;
  if (canEdit && fill === 'edit') {
    gap = (
      <Link
        className={INLINE_LINK}
        params={{ vehicleId: vehicle.id }}
        to="/vehicles/$vehicleId/edit"
      >
        {text}
      </Link>
    );
  } else if (canEdit && fill !== null && fill !== 'edit') {
    gap = (
      <Link
        className={INLINE_LINK}
        params={{ vehicleId: vehicle.id }}
        search={{ tab: fill }}
        to="/vehicles/$vehicleId"
      >
        {text}
      </Link>
    );
  }

  return (
    <>
      <span className="tabular-nums">{health.score}%</span> · {gap}
    </>
  );
}

function nextDueText(nextDue: NonNullable<DashboardVehicleHealth['nextDue']>) {
  if (nextDue.kind === 'loan_emi' && nextDue.dueDate) {
    const relative = formatRelativeDue({
      kind: nextDue.kind,
      daysUntilDue: nextDue.daysUntilDue,
      dueDate: nextDue.dueDate,
    });

    return nextDue.amount !== undefined
      ? `EMI ${format.money(nextDue.amount)} · ${relative}`
      : `EMI · ${relative}`;
  }

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
  const documents = describeVehicleDocuments(vehicle, today);
  const statusTab: VehicleDetailTab | undefined =
    vehicle.status === 'ok' || !vehicle.nextDue
      ? undefined
      : vehicle.nextDue.kind === 'reminder'
        ? 'reminders'
        : ATTENTION_KIND_TABS[vehicle.nextDue.kind];
  const kmSinceService = vehicle.lastService ? vehicle.odometer - vehicle.lastService.odometer : 0;

  return (
    <Card
      className={cn(
        '@container flex flex-col gap-3 border-slate-200/60 bg-white/70 transition-colors hover:bg-white',
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
            <Bike aria-hidden="true" className="h-5 w-5" />
          )}
        </div>

        <Link
          className="group min-w-0 flex-1 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              'rounded-sm hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
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
              className="rounded-sm hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              params={{ recordId: vehicle.lastService.recordId }}
              to="/maintenance-records/$recordId"
            >
              Serviced {format.date(vehicle.lastService.serviceDate)}
              {kmSinceService > 0 ? ` · ${format.distance(kmSinceService)} ago` : ''}
            </Link>
          ) : (
            <span className="text-slate-400">No service logged</span>
          )}
        </MicroRow>
        {vehicle.dataHealth ? (
          <MicroRow label="Data">
            <DataHealthText canEdit={canEdit} vehicle={vehicle} />
          </MicroRow>
        ) : null}
        <MicroRow label="Odometer">
          Updated {formatRelativeAgo(vehicle.odometerUpdatedAt, today)}
          {canEdit ? (
            <>
              {' · '}
              <OdometerQuickUpdate
                displayName={vehicle.displayName}
                odometer={vehicle.odometer}
                vehicleId={vehicle.id}
              />
            </>
          ) : null}
        </MicroRow>
      </div>

      {/* Where the grid adds a column (sm, then xl beside the sidebar), a card is narrower
          than on a phone, so the footer goes by the card's own width: under 22rem the
          reading gets a row to itself and the labelled actions take the row below. Icons
          alone (on a phone) or the menu alone (for a viewer) fit beside the reading. Both
          rows can still wrap, so a long reading or a wide font never pushes a button out
          of the card. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span
          className={cn(
            'shrink-0 whitespace-nowrap text-[12px] tabular-nums text-slate-500',
            canEdit && 'sm:basis-full sm:@[22rem]:basis-auto',
          )}
        >
          {format.odometer(vehicle.odometer)}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
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
                className="md:h-7 md:w-7"
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
