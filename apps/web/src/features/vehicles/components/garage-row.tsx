import { Link } from '@tanstack/react-router';
import { FuelType, VehicleRole } from '@vehicle-vault/shared';
import { IdCard } from 'lucide-react';

import { NumberPlate } from '@/components/shared/number-plate';
import { StatusDot } from '@/components/shared/status-pill';
import { nextDueText } from '@/features/dashboard/components/vehicle-health-rows';
import { ROLE_COPY } from '@/features/vehicle-sharing/lib/role-copy';
import type { DashboardVehicleHealth } from '@/features/dashboard/types/dashboard';
import { vehicleHealthStatus } from '@/features/dashboard/utils/status';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { Vehicle } from '../types/vehicle';
import { describeVehicleModel } from '../utils/describe-vehicle-model';
import { getVehicleDisplayName } from '../utils/get-vehicle-display-name';

type GarageRowProps = {
  vehicle: Vehicle;
  /** Home's reading of the vehicle; missing while the summary loads. */
  health: DashboardVehicleHealth | undefined;
  /** Select mode: a checkbox leads the row. */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
};

/**
 * One vehicle in the Garage: the plate and name, the model, registration and
 * reading, and one status with the item it is about ("1 late · Insurance
 * renewal · 3 days late", or "All clear · Next: Timing belt · in 20 days").
 * On a phone the status wraps under the name.
 */
export function GarageRow({
  vehicle,
  health,
  selectable = false,
  selected = false,
  onSelectedChange,
}: GarageRowProps) {
  const name = getVehicleDisplayName(vehicle);
  const status = health ? vehicleHealthStatus(health) : null;
  const next = health?.nextDue ? nextDueText(health.nextDue) : null;
  const shared = vehicle.currentUserRole && vehicle.currentUserRole !== VehicleRole.Owner;

  return (
    <li
      className={cn('flex items-stretch', selected && 'bg-brand-tint')}
      data-selected={selected ? 'true' : undefined}
      data-testid="garage-row"
    >
      {selectable ? (
        <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center">
          <input
            aria-label={`Select vehicle ${name}`}
            checked={selected}
            className="size-4 rounded border-line text-fg focus:ring-ring"
            onChange={(event) => onSelectedChange?.(event.currentTarget.checked)}
            type="checkbox"
          />
        </label>
      ) : null}

      <Link
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-2 py-4 pr-2 hover:bg-page/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-4',
          selectable ? 'pl-0' : 'pl-4 sm:pl-5',
        )}
        params={{ vehicleId: vehicle.id }}
        to="/vehicles/$vehicleId"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <NumberPlate
            electric={vehicle.fuelType === FuelType.Electric}
            registration={vehicle.registrationNumber}
            size="sm"
          />
          <div className="min-w-0">
            <h3 className="truncate text-body font-semibold text-fg">{name}</h3>
            <p className="truncate text-small text-fg-3">
              {describeVehicleModel(vehicle)} · {format.odometer(vehicle.odometer)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 sm:w-72 sm:shrink-0 sm:items-end sm:text-right">
          {status ? (
            <p className="flex min-w-0 max-w-full items-center gap-1.5 text-small">
              <StatusDot className="shrink-0" status={status.status}>
                {status.words}
              </StatusDot>
              {next ? (
                <span className="truncate text-fg-2">
                  {status.status === 'ok' ? `Next: ${next}` : next}
                </span>
              ) : null}
            </p>
          ) : null}
          {shared ? (
            <p className="text-caption text-fg-3">
              Shared · {ROLE_COPY[vehicle.currentUserRole!].title}
            </p>
          ) : null}
        </div>
      </Link>

      {/* Beside the link, not inside it: one tap to the papers, for every role. */}
      <Link
        aria-label={`Show papers for ${name}`}
        className="flex w-12 shrink-0 items-center justify-center text-fg-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        params={{ vehicleId: vehicle.id }}
        to="/vehicles/$vehicleId/papers"
      >
        <IdCard aria-hidden="true" className="size-5" />
      </Link>
    </li>
  );
}

const STATUS_RANK: Record<DashboardVehicleHealth['status'], number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
};

/**
 * Late vehicles first (most late items first), then the ones due soon, then
 * all-clear ones, each by how soon its next item is; a vehicle Home has no
 * reading for goes last. Ties keep the garage's alphabetical order.
 */
export function byUrgency(health: ReadonlyMap<string, DashboardVehicleHealth>) {
  return (left: Vehicle, right: Vehicle) => {
    const a = health.get(left.id);
    const b = health.get(right.id);
    if (!a || !b) return (a ? 0 : 1) - (b ? 0 : 1) || byName(left, right);

    const days = (entry: DashboardVehicleHealth) =>
      entry.nextDue?.daysUntilDue ?? Number.POSITIVE_INFINITY;

    return (
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.overdueCount - a.overdueCount ||
      days(a) - days(b) ||
      byName(left, right)
    );
  };
}

function byName(left: Vehicle, right: Vehicle) {
  return getVehicleDisplayName(left).localeCompare(getVehicleDisplayName(right));
}
