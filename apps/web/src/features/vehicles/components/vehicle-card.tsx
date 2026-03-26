import { Link } from '@tanstack/react-router';
import { CarFront, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { VehicleType } from '@vehicle-vault/shared';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import type { Vehicle } from '../types/vehicle';

type VehicleCardProps = {
  selectionControl?: ReactNode;
  vehicle: Vehicle;
};

export function VehicleCard({ selectionControl, vehicle }: VehicleCardProps) {
  const title = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;

  return (
    <div className="group relative flex items-center gap-4">
      {selectionControl ? (
        <div className="flex-shrink-0 transition-opacity duration-200">{selectionControl}</div>
      ) : null}

      <Card className="flex-1 overflow-hidden border-slate-200/60 bg-white/70 shadow-premium-sm transition-all duration-300 hover:border-primary/20 hover:bg-white hover:shadow-premium-md">
        <Link
          className="flex flex-col p-0 sm:flex-row sm:items-center"
          params={{ vehicleId: vehicle.id }}
          to="/vehicles/$vehicleId"
        >
          {/* Main Info Section */}
          <div className="flex flex-1 items-center gap-4 p-5 sm:p-6">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 shadow-inner group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {[VehicleType.Car, VehicleType.SUV, VehicleType.Truck, VehicleType.Van].includes(
                vehicle.vehicleType as VehicleType,
              ) ? (
                <CarFront className="h-6 w-6" />
              ) : (
                <div className="text-sm font-bold">M/C</div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors">
                  {title}
                </h3>
                <Badge tone="accent" className="shrink-0">
                  {vehicle.vehicleType}
                </Badge>
              </div>
              <p className="truncate text-[13px] font-medium text-slate-500">
                {vehicle.make} {vehicle.model} <span className="mx-1 text-slate-300">•</span>{' '}
                {vehicle.variant}
              </p>
            </div>
          </div>

          {/* Metadata Section - Hidden on very small screens, grid on mobile, flex on desktop */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 bg-slate-50/30 p-5 sm:flex sm:items-center sm:gap-8 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Registration
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                {vehicle.registrationNumber}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Odometer
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                {vehicle.odometer.toLocaleString('en-IN')} km
              </p>
            </div>

            <div className="hidden space-y-1 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Fuel Type
              </p>
              <p className="text-[13px] font-semibold text-slate-700">{vehicle.fuelType}</p>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-300 shadow-premium-sm transition-all group-hover:translate-x-1 group-hover:text-primary sm:ml-4">
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      </Card>
    </div>
  );
}
