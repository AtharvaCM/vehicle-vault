import { cn } from '@/lib/utils/cn';

import type { Vehicle } from '../types/vehicle';
import { getVehicleDisplayName } from '../utils/get-vehicle-display-name';

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
    <div className="grid grid-cols-1 gap-4">
      {vehicles.map((vehicle) => {
        const isSelected = selectedVehicleIds.includes(vehicle.id);

        return (
          <VehicleCard
            key={vehicle.id}
            selected={isSelected}
            selectionControl={
              onSelectionChange ? (
                <label
                  className="flex items-center justify-center rounded-md border border-border/70 bg-white p-2 shadow-sm"
                  onClick={(event) => {
                    // Only stop the click from bubbling to the card/link below —
                    // preventDefault() here would also cancel the checkbox's own
                    // native toggle, leaving it visually unchecked forever.
                    event.stopPropagation();
                  }}
                >
                  <input
                    aria-label={`Select vehicle ${getVehicleDisplayName(vehicle)}`}
                    checked={isSelected}
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
        );
      })}
    </div>
  );
}
