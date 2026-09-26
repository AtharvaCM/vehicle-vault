import { Link } from '@tanstack/react-router';
import { FuelType } from '@vehicle-vault/shared';
import { IdCard } from 'lucide-react';

import { NumberPlate } from '@/components/shared/number-plate';
import { StatusDot, StatusPill } from '@/components/shared/status-pill';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { DashboardVehicleHealth } from '../types/dashboard';
import { vehicleHealthStatus } from '../utils/status';
import { NextDueRow, OdometerRow, PapersRow } from './vehicle-health-rows';

type HomeGarageProps = {
  vehicles: DashboardVehicleHealth[];
  vehiclesTotal: number;
};

/**
 * Home's garage, kept small: one chip per vehicle (plate, name, one status),
 * scrolling sideways on a phone. A one-vehicle garage gets that vehicle's
 * summary row instead, with its odometer updatable in place.
 */
export function HomeGarage({ vehicles, vehiclesTotal }: HomeGarageProps) {
  const [only] = vehicles;
  if (vehiclesTotal === 1 && only) return <VehicleSummaryRow vehicle={only} />;

  const hiddenCount = vehiclesTotal - vehicles.length;

  return (
    <section aria-labelledby="garage-heading" className="scroll-mt-20 space-y-3" id="garage">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lead font-semibold tracking-tight" id="garage-heading">
            Garage
          </h2>
          <span className="text-small text-fg-3">{vehiclesTotal} vehicles</span>
        </div>
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/garage">
          All vehicles
        </Link>
      </div>

      {/* `relative`: each plate's screen-reader spelling is absolutely placed,
          and without a positioned ancestor here it escaped this row's
          scrolling and widened the whole page on a phone (#364). */}
      <ul
        className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        data-testid="garage-strip"
      >
        {vehicles.map((vehicle) => {
          const health = vehicleHealthStatus(vehicle);

          return (
            <li
              className="flex shrink-0 items-stretch rounded-card border border-line bg-surface transition-colors hover:border-brand"
              data-testid="garage-chip"
              key={vehicle.id}
            >
              <Link
                className="flex min-h-14 items-center gap-3 rounded-l-card py-2 pl-3 pr-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                params={{ vehicleId: vehicle.id }}
                to="/vehicles/$vehicleId"
              >
                <NumberPlate
                  electric={vehicle.fuelType === FuelType.Electric}
                  registration={vehicle.registrationNumber}
                  size="sm"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="max-w-40 truncate text-ui font-semibold text-fg">
                    {vehicle.displayName}
                  </span>
                  <StatusDot status={health.status}>{health.words}</StatusDot>
                </span>
              </Link>
              {/* Two taps from Home to the papers, for every role (#296). */}
              <ShowPapersLink vehicle={vehicle} />
            </li>
          );
        })}
        {hiddenCount > 0 ? (
          <li className="shrink-0">
            <Link
              className="flex min-h-14 items-center rounded-card border border-dashed border-line px-4 text-ui font-medium text-fg-2 transition-colors hover:border-brand hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              to="/garage"
            >
              +{hiddenCount} more
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** The one vehicle of a one-vehicle garage: who it is, how it stands, and its odometer. */
function VehicleSummaryRow({ vehicle }: { vehicle: DashboardVehicleHealth }) {
  const canEdit = vehicle.currentUserRole !== 'viewer';
  const health = vehicleHealthStatus(vehicle);

  return (
    <Card className="flex flex-col gap-3" data-testid="vehicle-summary-row" id="garage" size="sm">
      <div className="flex items-start gap-3">
        <Link
          className="min-w-0 flex-1 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          params={{ vehicleId: vehicle.id }}
          to="/vehicles/$vehicleId"
        >
          <VehicleIdentity
            electric={vehicle.fuelType === FuelType.Electric}
            layout="card"
            name={vehicle.displayName}
            registration={vehicle.registrationNumber}
          />
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill status={health.status}>{health.words}</StatusPill>
          <Link
            aria-label={`Show papers for ${vehicle.displayName}`}
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
            params={{ vehicleId: vehicle.id }}
            to="/vehicles/$vehicleId/papers"
          >
            <IdCard aria-hidden="true" />
            Show papers
          </Link>
        </div>
      </div>
      {/* Two across until lg: three across, the odometer's Update ran out of room at 640px. */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <NextDueRow vehicle={vehicle} />
        <PapersRow vehicle={vehicle} />
        <OdometerRow canEdit={canEdit} showReading vehicle={vehicle} />
      </div>
    </Card>
  );
}

function ShowPapersLink({ vehicle }: { vehicle: DashboardVehicleHealth }) {
  return (
    <Link
      aria-label={`Show papers for ${vehicle.displayName}`}
      className="flex w-11 shrink-0 items-center justify-center rounded-r-card border-l border-line-subtle text-fg-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      params={{ vehicleId: vehicle.id }}
      to="/vehicles/$vehicleId/papers"
    >
      <IdCard aria-hidden="true" className="size-5" />
    </Link>
  );
}
