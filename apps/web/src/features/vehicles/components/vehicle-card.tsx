import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { Vehicle } from '../types/vehicle';

type VehicleCardProps = {
  selectionControl?: ReactNode;
  vehicle: Vehicle;
};

export function VehicleCard({ selectionControl, vehicle }: VehicleCardProps) {
  const title = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;

  return (
    <div className="flex items-start gap-3">
      {selectionControl ? <div className="pt-3">{selectionControl}</div> : null}
      <Card className="flex-1">
        <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{title}</CardTitle>
              <Badge tone="accent">{vehicle.vehicleType}</Badge>
            </div>
            <CardDescription>
              {vehicle.registrationNumber} • {vehicle.make} {vehicle.model} • {vehicle.variant}
            </CardDescription>
          </div>

          <Link
            className={buttonVariants({ size: 'xs', variant: 'outline' })}
            params={{ vehicleId: vehicle.id }}
            to="/vehicles/$vehicleId"
          >
            Open
          </Link>
        </CardHeader>
        <CardContent className="grid gap-x-4 gap-y-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
          <VehicleMeta label="Fuel" value={vehicle.fuelType} />
          <VehicleMeta label="Type" value={vehicle.vehicleType} />
          <VehicleMeta label="Year" value={String(vehicle.year)} />
          <VehicleMeta label="Odometer" value={`${vehicle.odometer.toLocaleString('en-IN')} km`} />
        </CardContent>
      </Card>
    </div>
  );
}

function VehicleMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="flex items-center gap-1 text-[13px] font-medium text-slate-900">
        <span>{value}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
      </div>
    </div>
  );
}
