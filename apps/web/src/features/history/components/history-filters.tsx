import type { HistoryKind } from '@vehicle-vault/shared';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';
import { format } from '@/lib/format';

import type { HistoryVehicle } from './history-row';

const KIND_OPTIONS: { value: HistoryKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'service', label: 'Service' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'odometer', label: 'Odometer' },
  { value: 'accessory', label: 'Accessory' },
];

type HistoryFiltersProps = {
  vehicles: HistoryVehicle[];
  vehicleId: string | undefined;
  kind: HistoryKind | undefined;
  onVehicleChange: (vehicleId: string | undefined) => void;
  onKindChange: (kind: HistoryKind | undefined) => void;
};

/** Which vehicle and which kind of entry: both kept in the URL by the route. */
export function HistoryFilters({
  vehicles,
  vehicleId,
  kind,
  onVehicleChange,
  onKindChange,
}: HistoryFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {vehicles.length > 1 ? (
        <Select
          onValueChange={(value) => onVehicleChange(value === 'all' ? undefined : value)}
          value={vehicleId ?? 'all'}
        >
          <SelectTrigger aria-label="Vehicle" className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {getVehicleDisplayName(vehicle)} · {format.registration(vehicle.registrationNumber)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <ToggleGroup
        aria-label="Show"
        className="flex w-full sm:inline-flex sm:w-auto"
        onValueChange={(value) => {
          // Radix clears the value when the pressed item is pressed again.
          if (value) onKindChange(value === 'all' ? undefined : (value as HistoryKind));
        }}
        type="single"
        value={kind ?? 'all'}
      >
        {KIND_OPTIONS.map((option) => (
          <ToggleGroupItem className="flex-1 sm:flex-none" key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
