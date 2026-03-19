import type { Vehicle } from '../types/vehicle';

import { VehicleCard } from './vehicle-card';

type VehicleListProps = {
  vehicles: Vehicle[];
};

export function VehicleList({ vehicles }: VehicleListProps) {
  return (
    <div className="grid gap-4">
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
}
