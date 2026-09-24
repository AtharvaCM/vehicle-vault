import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { FuelType } from '@vehicle-vault/shared';

import { Badge } from '@/components/ui/badge';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';
import { describeVehicleModel } from '../utils/describe-vehicle-model';
import { getVehicleDisplayName } from '../utils/get-vehicle-display-name';
import { Card } from '@/components/ui/card';

import type { Vehicle } from '../types/vehicle';

type VehicleCardProps = {
  selected?: boolean;
  selectionControl?: ReactNode;
  vehicle: Vehicle;
};

export function VehicleCard({ selected = false, selectionControl, vehicle }: VehicleCardProps) {
  const title = getVehicleDisplayName(vehicle);

  return (
    <div className="group relative flex items-center gap-4">
      {selectionControl ? (
        <div className="shrink-0 transition-opacity duration-200">{selectionControl}</div>
      ) : null}

      <Card
        className={cn(
          'flex-1 overflow-hidden border-slate-200/60 bg-white/70 transition-all duration-300 hover:border-primary/20 hover:bg-white',
          selected && 'ring-2 ring-primary',
        )}
      >
        <Link
          className="flex flex-col p-0 sm:flex-row sm:items-center"
          params={{ vehicleId: vehicle.id }}
          to="/vehicles/$vehicleId"
        >
          {/* Main Info Section: the plate leads, the nickname and model follow it. */}
          <div className="flex min-w-0 flex-1 items-center gap-4 p-5 sm:p-6">
            <VehicleIdentity
              className="min-w-0 flex-1"
              details={describeVehicleModel(vehicle)}
              electric={vehicle.fuelType === FuelType.Electric}
              layout="row"
              name={title}
              nameAs="h3"
              registration={vehicle.registrationNumber}
            />
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Badge tone="accent">{format.enumLabel('vehicleType', vehicle.vehicleType)}</Badge>
              {vehicle.currentUserRole && vehicle.currentUserRole !== 'owner' ? (
                <Badge className="bg-blue-100 text-blue-800">
                  Shared • {format.enumLabel('vehicleRole', vehicle.currentUserRole)}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Metadata Section - Hidden on very small screens, grid on mobile, flex on desktop */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 bg-slate-50/30 p-5 sm:flex sm:items-center sm:gap-8 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Odometer
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                {format.odometer(vehicle.odometer)}
              </p>
            </div>

            <div className="hidden space-y-1 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Fuel type
              </p>
              <p className="text-[13px] font-semibold text-slate-700">
                {format.enumLabel('fuelType', vehicle.fuelType)}
              </p>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-primary sm:ml-4">
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      </Card>
    </div>
  );
}
