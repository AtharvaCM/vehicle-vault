import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

import type { Vehicle } from '../types/vehicle';

import { describeVehicleModel } from '../utils/describe-vehicle-model';

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
          <Badge tone="accent">{format.enumLabel('vehicleType', vehicle.vehicleType)}</Badge>
          <Badge>{format.enumLabel('fuelType', vehicle.fuelType)}</Badge>
        </div>
        <CardDescription>
          {vehicle.registrationNumber} • {describeVehicleModel(vehicle)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-fg-2 sm:grid-cols-2">
        <p>Year: {vehicle.year}</p>
        <p>Odometer: {format.odometer(vehicle.odometer)}</p>
        <p>Added: {format.date(vehicle.createdAt)}</p>
        <p>Last updated: {format.date(vehicle.updatedAt)}</p>
      </CardContent>
    </Card>
  );
}
