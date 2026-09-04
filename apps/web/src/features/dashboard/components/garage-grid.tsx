import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';

import type { DashboardVehicleHealth } from '../types/dashboard';
import { VehicleHealthCard } from './vehicle-health-card';

type GarageGridProps = {
  vehicles: DashboardVehicleHealth[];
  vehiclesTotal: number;
};

export function GarageGrid({ vehicles, vehiclesTotal }: GarageGridProps) {
  const hiddenCount = vehiclesTotal - vehicles.length;

  return (
    <section aria-labelledby="garage-heading" className="scroll-mt-20 space-y-3" id="garage">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight" id="garage-heading">
            Garage
          </h2>
          <span className="text-[13px] text-slate-500">
            {vehiclesTotal} vehicle{vehiclesTotal === 1 ? '' : 's'}
          </span>
        </div>
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/vehicles">
          All vehicles
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => (
          <VehicleHealthCard key={vehicle.id} vehicle={vehicle} />
        ))}
        {hiddenCount > 0 ? (
          <Link
            className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-sm font-medium text-slate-600 transition-colors hover:border-primary/30 hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            to="/vehicles"
          >
            +{hiddenCount} more in Vehicles
          </Link>
        ) : null}
      </div>
    </section>
  );
}
