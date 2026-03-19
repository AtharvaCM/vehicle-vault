import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/format-date';

import type { VehicleSummary } from '../types/vehicle';

type VehicleListProps = {
  vehicles: VehicleSummary[];
};

export function VehicleList({ vehicles }: VehicleListProps) {
  return (
    <div className="grid gap-4">
      {vehicles.map((vehicle) => (
        <Card key={vehicle.id}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>
                {vehicle.make} {vehicle.model}
              </CardTitle>
              <CardDescription>
                {vehicle.registrationNumber} • {vehicle.variant} • {vehicle.year}
              </CardDescription>
            </div>

            <Link
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              to="/vehicles/$vehicleId"
              params={{ vehicleId: vehicle.id }}
            >
              View Vehicle
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <p>Fuel type: {vehicle.fuelType}</p>
            <p>Odometer: {vehicle.odometer.toLocaleString('en-IN')} km</p>
            <p>
              Last service:{' '}
              {vehicle.lastServiceDate ? formatDate(vehicle.lastServiceDate) : 'Not recorded'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
