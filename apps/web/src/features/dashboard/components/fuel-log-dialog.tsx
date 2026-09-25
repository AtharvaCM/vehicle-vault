import { useEffect, useRef, useState } from 'react';
import { FuelType, type CreateFuelLogInput } from '@vehicle-vault/shared';

import { FormField } from '@/components/shared/form-field';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FuelLogForm } from '@/features/fuel-logs/components/fuel-log-form';
import { useCreateFuelLog } from '@/features/fuel-logs/hooks/use-create-fuel-log';
import { fuelNoun } from '@/features/fuel-logs/utils/fuel-unit';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import type { QuickLogVehicle } from './quick-log-dialog';

type FuelLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only the vehicles the user can log against. */
  vehicles: QuickLogVehicle[];
};

/**
 * The fuel tab's own form, opened straight from the dashboard so a fill can be
 * logged in one tap from the same place as a service.
 */
export function FuelLogDialog({ open, onOpenChange, vehicles }: FuelLogDialogProps) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const createFuelLog = useCreateFuelLog(vehicleId);
  const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
  const fuelType = vehicle?.fuelType ?? FuelType.Petrol;
  const noun = fuelNoun(fuelType);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) setVehicleId(vehicles[0]?.id ?? '');
    wasOpen.current = open;
  }, [open, vehicles]);

  async function handleSubmit(values: CreateFuelLogInput) {
    try {
      await createFuelLog.mutateAsync(values);
      appToast.success({
        title: 'Fuel log saved',
        description: vehicle ? `Your fill on ${vehicle.displayName} is recorded.` : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      appToast.error({
        title: "Couldn't save the fuel log",
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Log {noun.toLowerCase()}</DialogTitle>
        </DialogHeader>
        {vehicles.length > 1 ? (
          <FormField htmlFor="fuel-log-vehicle" label="Vehicle">
            <Select onValueChange={setVehicleId} value={vehicleId}>
              <SelectTrigger id="fuel-log-vehicle">
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.displayName} · {candidate.registrationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        <FuelLogForm
          fuelType={fuelType}
          isSubmitting={createFuelLog.isPending}
          key={vehicleId}
          lastOdometer={vehicle?.odometer}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
