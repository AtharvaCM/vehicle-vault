import { Link } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import { FuelType } from '@vehicle-vault/shared';

import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import { describeVehicleModel } from '@/features/vehicles/utils/describe-vehicle-model';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';

import { tcoQueryOptions } from '../api/get-tco';
import { costPerKmHint } from '../utils/cost-per-km-hint';

/**
 * One row per vehicle: lifetime spend and cost per km, each vehicle's own
 * TCO query so a slow or failed one never blocks the others (#192: no ₹/km
 * figure below the minimum distance on file).
 */
export function VehicleSpendList() {
  const vehiclesQuery = useVehicles();
  const vehicles = vehiclesQuery.data ?? [];

  const tcoQueries = useQueries({
    queries: vehicles.map((vehicle) => tcoQueryOptions(vehicle.id)),
  });

  if (vehiclesQuery.isLoading) {
    return <p className="text-body text-fg-3">Loading your vehicles…</p>;
  }

  if (vehiclesQuery.isError) {
    return (
      <p className="text-body text-late">Your vehicles could not be loaded. Try again shortly.</p>
    );
  }

  if (vehicles.length === 0) {
    return <p className="text-body text-fg-2">Add a vehicle to see what it costs to run.</p>;
  }

  return (
    <div className="divide-y divide-line-subtle rounded-card border border-line bg-surface">
      {vehicles.map((vehicle, index) => {
        const tcoQuery = tcoQueries[index];

        return (
          <Link
            className="flex flex-col gap-3 p-4 transition-colors hover:bg-page/60 focus-visible:outline-hidden focus-visible:-outline-offset-2 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            key={vehicle.id}
            params={{ vehicleId: vehicle.id }}
            to="/vehicles/$vehicleId"
          >
            <VehicleIdentity
              className="min-w-0"
              details={describeVehicleModel(vehicle)}
              electric={vehicle.fuelType === FuelType.Electric}
              layout="row"
              name={getVehicleDisplayName(vehicle)}
              registration={vehicle.registrationNumber}
            />

            <div className="grid grid-cols-2 gap-4 sm:flex sm:shrink-0 sm:items-center sm:gap-8">
              {tcoQuery?.isLoading ? (
                <span className="col-span-2 text-small text-fg-3 sm:col-span-1">Loading…</span>
              ) : tcoQuery?.isError ? (
                <span className="col-span-2 text-small text-late sm:col-span-1">
                  Spend could not be loaded
                </span>
              ) : tcoQuery?.data ? (
                <>
                  {/* With a purchase on file, what owning it has cost leads; else the spend. */}
                  <Figure
                    hint={tcoQuery.data.totals.tco ? 'Purchase and running' : undefined}
                    label={tcoQuery.data.totals.tco ? 'Cost of owning' : 'Spent in all'}
                    value={
                      <Money
                        value={Number(tcoQuery.data.totals.tco ?? tcoQuery.data.totals.netSpend)}
                      />
                    }
                  />
                  <Figure
                    hint={costPerKmHint(tcoQuery.data)}
                    label="Cost per km"
                    value={
                      <>
                        <Money
                          decimals={1}
                          value={
                            tcoQuery.data.derived.costPerKm
                              ? Number(tcoQuery.data.derived.costPerKm)
                              : null
                          }
                        />
                        {tcoQuery.data.derived.costPerKm ? ' / km' : null}
                      </>
                    }
                  />
                </>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
