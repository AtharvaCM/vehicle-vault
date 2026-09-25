import { Fuel, Gauge } from 'lucide-react';
import type { FuelType } from '@vehicle-vault/shared';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { FuelEconomyCard } from '@/features/fuel-logs/components/fuel-economy-card';
import { FuelTab } from '@/features/fuel-logs/components/fuel-tab';
import type { HistoryVehicle } from '@/features/history/components/history-row';
import { ServiceHistoryCard } from '@/features/service-baseline/components/service-history-card';

import { OdometerHistoryCard } from './odometer-history-card';
import { VehicleServiceHistory } from './vehicle-service-history';
import type { VehicleHistoryView } from '../types/vehicle-detail-search';
import type { VehicleServiceInsights } from '../utils/get-vehicle-service-insights';

type VehicleHistoryTabProps = {
  vehicle: HistoryVehicle;
  fuelType: FuelType;
  /** The vehicle's current reading, passed through to the fuel tab's Odometer hint. */
  odometer: number;
  serviceInsights: VehicleServiceInsights;
  view: VehicleHistoryView;
  onViewChange: (view: VehicleHistoryView) => void;
  /** The service log's search, kept in the URL. */
  search: string | undefined;
  onSearchChange: (search: string | undefined) => void;
};

export function VehicleHistoryTab({
  vehicle,
  fuelType,
  odometer,
  serviceInsights,
  view,
  onViewChange,
  search,
  onSearchChange,
}: VehicleHistoryTabProps) {
  const vehicleId = vehicle.id;

  return (
    <div className="space-y-6">
      <ToggleGroup
        aria-label="Show"
        onValueChange={(value) => {
          if (value) onViewChange(value as VehicleHistoryView);
        }}
        type="single"
        value={view}
      >
        <ToggleGroupItem value="service">Service</ToggleGroupItem>
        <ToggleGroupItem value="fuel">Fuel</ToggleGroupItem>
      </ToggleGroup>

      {view === 'service' ? (
        <>
          <div className="mb-6">
            <ServiceHistoryCard vehicleId={vehicleId} />
          </div>
          <VehicleServiceHistory
            onSearchChange={onSearchChange}
            search={search}
            vehicle={vehicle}
          />
          <OdometerHistoryCard insights={serviceInsights} />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <FuelTab fuelType={fuelType} odometer={odometer} vehicleId={vehicleId} />
          <div className="h-fit space-y-6">
            <FuelEconomyCard vehicleId={vehicleId} />
            <Card className="h-fit border-line/60 bg-surface/70">
              <CardHeader>
                <CardTitle className="text-lead font-bold">Getting an accurate figure</CardTitle>
                <CardDescription>Economy is measured between fill-ups.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-small leading-relaxed text-fg-3">
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0 text-primary">
                    <Fuel className="h-4 w-4" />
                  </div>
                  <p>Log every fill-up to see how your driving habits affect your fuel economy.</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0 text-primary">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <p>Capture the precise odometer reading for accurate consumption calculation.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
