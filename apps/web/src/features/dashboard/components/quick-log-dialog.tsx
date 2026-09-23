import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { format } from '@/lib/format';

import { useQuickLog } from '../hooks/use-quick-log';
import { quickLogSchema, type QuickLogValues } from '../schemas/quick-log.schema';
import type { DashboardVehicleHealth } from '../types/dashboard';

export type QuickLogVehicle = Pick<
  DashboardVehicleHealth,
  'id' | 'displayName' | 'registrationNumber' | 'odometer'
>;

type QuickLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only the vehicles the user can log against; a viewer's are left out upstream. */
  vehicles: QuickLogVehicle[];
};

const today = () => new Date().toISOString().slice(0, 10);

function defaultsFor(vehicle: QuickLogVehicle | undefined): QuickLogValues {
  return {
    vehicleId: vehicle?.id ?? '',
    serviceDate: today(),
    // The last reading on file, to overwrite with what the dashboard shows now.
    odometer: vehicle?.odometer ?? 0,
    totalCost: undefined as unknown as number,
  };
}

/**
 * A service logged standing at the workshop counter, in under a minute: date,
 * odometer, cost, and a photo of the job card if there is one. See
 * `useQuickLog` for what it saves and why.
 */
export function QuickLogDialog({ open, onOpenChange, vehicles }: QuickLogDialogProps) {
  const quickLog = useQuickLog();
  const [photo, setPhoto] = useState<File | null>(null);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<QuickLogValues>({
    resolver: zodResolver(quickLogSchema),
    defaultValues: defaultsFor(vehicles[0]),
  });

  // Reset on opening only: the list refetching mid-entry must not wipe what was typed.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(defaultsFor(vehicles[0]));
      setPhoto(null);
    }
    wasOpen.current = open;
  }, [open, reset, vehicles]);

  const vehicleId = watch('vehicleId');
  const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);

  async function onSubmit(values: QuickLogValues) {
    if (!vehicle) return;

    try {
      const outcome = await quickLog.mutateAsync({
        vehicle,
        serviceDate: values.serviceDate,
        odometer: values.odometer,
        totalCost: values.totalCost,
        photo,
      });
      const problems = [
        outcome.odometerFailed ? "the vehicle's odometer wasn't updated" : null,
        outcome.photoFailed ? "the photo didn't upload; add it from the record" : null,
      ].filter(Boolean);

      if (problems.length > 0) {
        appToast.info({ title: 'Service logged', description: `But ${problems.join(', and ')}.` });
      } else {
        appToast.success({
          title: 'Service logged',
          description: `${format.money(values.totalCost)} on ${vehicle.displayName}. Add the details from the record any time.`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      appToast.error({
        title: "Couldn't log the service",
        description: getApiErrorMessage(error, 'Please check the details and try again.'),
      });
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a service</DialogTitle>
          <DialogDescription>
            What you know at the counter. What was done can be added later.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          {vehicles.length > 1 ? (
            <FormField
              error={errors.vehicleId?.message}
              htmlFor="quick-log-vehicle"
              label="Vehicle"
            >
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select
                    onValueChange={(next) => {
                      field.onChange(next);
                      const chosen = vehicles.find((candidate) => candidate.id === next);
                      if (chosen) setValue('odometer', chosen.odometer);
                    }}
                    value={field.value}
                  >
                    <SelectTrigger id="quick-log-vehicle">
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
                )}
              />
            </FormField>
          ) : null}

          <FormField error={errors.serviceDate?.message} htmlFor="quick-log-date" label="Date">
            <Input id="quick-log-date" type="date" {...register('serviceDate')} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={errors.odometer?.message}
              htmlFor="quick-log-odometer"
              label="Odometer (km)"
            >
              <Input
                id="quick-log-odometer"
                inputMode="numeric"
                min={0}
                type="number"
                {...register('odometer', { valueAsNumber: true })}
              />
            </FormField>
            <FormField error={errors.totalCost?.message} htmlFor="quick-log-cost" label="Cost">
              <Input
                id="quick-log-cost"
                inputMode="decimal"
                min={0}
                step="0.01"
                type="number"
                {...register('totalCost', { valueAsNumber: true })}
              />
            </FormField>
          </div>

          <FormField
            description="Optional. The job card or the bill, attached to the record as it is."
            htmlFor="quick-log-photo"
            label="Photo"
          >
            <Input
              accept="image/*,application/pdf"
              capture="environment"
              id="quick-log-photo"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              type="file"
            />
          </FormField>

          <DialogFooter className="gap-2 sm:justify-between">
            {vehicle ? (
              <Link
                className="self-center text-sm font-medium text-slate-600 underline-offset-4 hover:underline"
                onClick={() => onOpenChange(false)}
                params={{ vehicleId: vehicle.id }}
                to="/vehicles/$vehicleId/maintenance/new"
              >
                Use the full form
              </Link>
            ) : (
              <span />
            )}
            <Button disabled={quickLog.isPending} type="submit">
              {quickLog.isPending ? 'Saving…' : 'Log service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
