import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateTyreInspectionInput, Tyre } from '@vehicle-vault/shared';

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
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useCreateTyreInspections } from '../hooks/use-tyres';
import {
  hasReading,
  tyreInspectionFormSchema,
  type TyreInspectionFormValues,
} from '../schemas/tyre-form.schema';
import { POSITION_LABEL } from '../utils/tyre-labels';

interface TyreInspectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleOdometer: number;
  /** Currently fitted tyres. Removed ones cannot be inspected. */
  tyres: Tyre[];
}

function buildDefaults(tyres: Tyre[], vehicleOdometer: number): TyreInspectionFormValues {
  return {
    inspectedAt: new Date().toISOString().slice(0, 10),
    odometer: vehicleOdometer,
    notes: '',
    readings: tyres.map((tyre) => ({
      tyreId: tyre.id,
      treadDepthMm: undefined,
      pressurePsi: undefined,
    })),
  };
}

/**
 * A tyre check is one walk-around of the vehicle, so the date and odometer are
 * asked for once and every corner shares them. Only corners the user actually
 * measured are submitted — a blank row is a tyre they did not get to, not a
 * reading of zero.
 */
export function TyreInspectionDialog({
  isOpen,
  onClose,
  vehicleId,
  vehicleOdometer,
  tyres,
}: TyreInspectionDialogProps) {
  const createMutation = useCreateTyreInspections(vehicleId);

  const fitted = useMemo(() => tyres.filter((tyre) => tyre.removedDate == null), [tyres]);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TyreInspectionFormValues>({
    resolver: zodResolver(tyreInspectionFormSchema),
    defaultValues: buildDefaults(fitted, vehicleOdometer),
  });

  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(fitted, vehicleOdometer));
    }
  }, [isOpen, fitted, vehicleOdometer, reset]);

  async function onSubmit(values: TyreInspectionFormValues) {
    const inspectedAt = new Date(values.inspectedAt).toISOString();
    const notes = values.notes?.trim() || null;

    const payloads: CreateTyreInspectionInput[] = values.readings
      .filter(hasReading)
      .map((reading) => ({
        tyreId: reading.tyreId,
        inspectedAt,
        odometer: values.odometer,
        treadDepthMm: reading.treadDepthMm ?? null,
        pressurePsi: reading.pressurePsi ?? null,
        notes,
      }));

    try {
      const { saved, failed } = await createMutation.mutateAsync(payloads);

      if (failed > 0) {
        // Say exactly what landed. Reporting a clean save when rows were lost
        // would leave the user believing a tyre is measured when it is not.
        appToast.error({
          title: `Saved ${saved} of ${saved + failed} readings`,
          description: 'Some readings could not be saved. Re-enter those and try again.',
        });
        return;
      }

      appToast.success({
        title: 'Inspection logged',
        description: `${saved} ${saved === 1 ? 'reading' : 'readings'} recorded.`,
      });
      onClose();
    } catch (error) {
      appToast.error({
        title: "Couldn't log the inspection",
        description: getApiErrorMessage(error, 'Please check the readings and try again.'),
      });
    }
  }

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={isOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a tyre inspection</DialogTitle>
          <DialogDescription>
            Record tread depth and pressure for each tyre. Leave a corner blank if
            you did not measure it.
          </DialogDescription>
        </DialogHeader>

        {fitted.length === 0 ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              No tyres are being tracked for this vehicle yet. Add a tyre first, then
              you can record readings against it.
            </p>
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="secondary">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                error={errors.inspectedAt?.message}
                htmlFor="inspection-date"
                label="Inspected on"
              >
                <Input id="inspection-date" type="date" {...register('inspectedAt')} />
              </FormField>
              <FormField
                error={errors.odometer?.message}
                htmlFor="inspection-odo"
                label="Odometer"
              >
                <Input
                  id="inspection-odo"
                  min={0}
                  type="number"
                  {...register('odometer', { valueAsNumber: true })}
                />
              </FormField>
            </div>

            <div className="grid gap-3">
              <p className="text-[13px] font-medium text-foreground/90">Readings</p>
              {errors.readings?.root?.message ? (
                <p className="text-xs leading-5 text-rose-600">{errors.readings.root.message}</p>
              ) : null}

              {fitted.map((tyre, index) => (
                <div
                  key={tyre.id}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-tight text-slate-900">
                      {POSITION_LABEL[tyre.position]}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {[tyre.brand, tyre.model, tyre.size].filter(Boolean).join(' · ') ||
                        'No tyre details recorded'}
                    </p>
                  </div>

                  <FormField
                    className="w-full sm:w-28"
                    error={errors.readings?.[index]?.treadDepthMm?.message}
                    htmlFor={`tread-${tyre.id}`}
                    label="Tread (mm)"
                  >
                    <Input
                      id={`tread-${tyre.id}`}
                      max={30}
                      min={0}
                      placeholder="6.5"
                      step="0.1"
                      type="number"
                      {...register(`readings.${index}.treadDepthMm`, {
                        setValueAs: (value) => (value === '' ? undefined : Number(value)),
                      })}
                    />
                  </FormField>

                  <FormField
                    className="w-full sm:w-28"
                    error={errors.readings?.[index]?.pressurePsi?.message}
                    htmlFor={`psi-${tyre.id}`}
                    label="Pressure (psi)"
                  >
                    <Input
                      id={`psi-${tyre.id}`}
                      max={120}
                      min={0}
                      placeholder="33"
                      step="0.5"
                      type="number"
                      {...register(`readings.${index}.pressurePsi`, {
                        setValueAs: (value) => (value === '' ? undefined : Number(value)),
                      })}
                    />
                  </FormField>

                  <input type="hidden" {...register(`readings.${index}.tyreId`)} />
                </div>
              ))}
            </div>

            <FormField error={errors.notes?.message} htmlFor="inspection-notes" label="Notes">
              <Textarea id="inspection-notes" rows={2} {...register('notes')} />
            </FormField>

            <DialogFooter>
              <Button onClick={onClose} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={createMutation.isPending} type="submit">
                {createMutation.isPending ? 'Saving…' : 'Save inspection'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
