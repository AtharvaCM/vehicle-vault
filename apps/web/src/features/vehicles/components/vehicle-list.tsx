import { cn } from '@/lib/utils/cn';

import type { Vehicle } from '../types/vehicle';

import { VehicleCard } from './vehicle-card';

type VehicleListProps = {
  onSelectionChange?: (vehicleId: string, checked: boolean) => void;
  selectedVehicleIds?: string[];
  vehicles: Vehicle[];
};

export function VehicleList({
  onSelectionChange,
  selectedVehicleIds = [],
  vehicles,
}: VehicleListProps) {
  return (
    <div className="grid gap-4">
      {vehicles.map((vehicle) => (
        <VehicleCard
          key={vehicle.id}
          selectionControl={
            onSelectionChange ? (
              <label
                className="flex items-center justify-center rounded-md border border-border/70 bg-white p-2 shadow-sm"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <input
                  aria-label={`Select vehicle ${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`}`}
                  checked={selectedVehicleIds.includes(vehicle.id)}
                  className={cn(
                    'h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400',
                  )}
                  onChange={(event) => onSelectionChange(vehicle.id, event.currentTarget.checked)}
                  type="checkbox"
                />
              </label>
            ) : null
          }
          vehicle={vehicle}
        />
      ))}
    </div>
  );
}
