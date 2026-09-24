import { ClipboardList, Fuel, Gauge, Plus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { FuelEconomyCard } from '@/features/fuel-logs/components/fuel-economy-card';
import { FuelTab } from '@/features/fuel-logs/components/fuel-tab';
import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { ServiceHistoryCard } from '@/features/service-baseline/components/service-history-card';

import { MaintenancePanel } from './maintenance-panel';
import { OdometerHistoryCard } from './odometer-history-card';
import type { VehicleHistoryView } from '../types/vehicle-detail-search';
import type { VehicleServiceInsights } from '../utils/get-vehicle-service-insights';

type VehicleHistoryTabProps = {
  vehicleId: string;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
  serviceInsights: VehicleServiceInsights;
  view: VehicleHistoryView;
  onViewChange: (view: VehicleHistoryView) => void;
};

export function VehicleHistoryTab({
  vehicleId,
  maintenanceQuery,
  serviceInsights,
  view,
  onViewChange,
}: VehicleHistoryTabProps) {
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
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <MaintenancePanel
              maintenanceQuery={maintenanceQuery}
              title="Service history"
              vehicleId={vehicleId}
              visibleCount={undefined}
            />
            <Card className="h-fit border-line/60 bg-surface/70">
              <CardHeader>
                <CardTitle className="text-lead font-bold">Vehicle health</CardTitle>
                <CardDescription>Maintain a perfect digital service record.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-small leading-relaxed text-fg-3">
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0 text-primary">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <p>Log each visit or repair with the odometer so the timeline stays accurate.</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <p>Open a service record to attach receipts, invoices, or photos.</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0 text-primary">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <p>Use next due fields to capture what should happen next.</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <OdometerHistoryCard insights={serviceInsights} />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <FuelTab vehicleId={vehicleId} />
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
