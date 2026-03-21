import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/format-date';

import type { Vehicle } from '../types/vehicle';

type VehicleSummaryCardProps = {
  vehicle: Vehicle;
};

export function VehicleSummaryCard({ vehicle }: VehicleSummaryCardProps) {
  const title = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge tone="accent">{vehicle.vehicleType}</Badge>
          <Badge>{vehicle.fuelType}</Badge>
        </div>
        <CardDescription>
          {vehicle.registrationNumber} • {vehicle.make} {vehicle.model} • {vehicle.variant}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <p>Year: {vehicle.year}</p>
        <p>Odometer: {vehicle.odometer.toLocaleString('en-IN')} km</p>
        <p>Added: {formatDate(vehicle.createdAt)}</p>
        <p>Last updated: {formatDate(vehicle.updatedAt)}</p>
      </CardContent>
    </Card>
  );
}
