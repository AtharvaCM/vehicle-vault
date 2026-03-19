import { Link } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { Vehicle } from '../types/vehicle';

type VehicleCardProps = {
  vehicle: Vehicle;
};

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const title = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{title}</CardTitle>
            <Badge tone="accent">{vehicle.vehicleType}</Badge>
          </div>
          <CardDescription>
            {vehicle.registrationNumber} • {vehicle.make} {vehicle.model} • {vehicle.variant}
          </CardDescription>
        </div>

        <Link
          className={buttonVariants({ size: 'sm', variant: 'secondary' })}
          params={{ vehicleId: vehicle.id }}
          to="/vehicles/$vehicleId"
        >
          View Vehicle
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
        <p>Fuel type: {vehicle.fuelType}</p>
        <p>Vehicle type: {vehicle.vehicleType}</p>
        <p>Year: {vehicle.year}</p>
        <p>Odometer: {vehicle.odometer.toLocaleString('en-IN')} km</p>
      </CardContent>
    </Card>
  );
}
