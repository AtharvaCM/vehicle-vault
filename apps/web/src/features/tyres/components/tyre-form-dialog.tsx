import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  isTwoWheeler,
  TyrePosition,
  VehicleType,
  type CreateTyreInput,
  type Tyre,
  type UpdateTyreInput,
} from '@vehicle-vault/shared';

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
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { useCreateTyre, useUpdateTyre } from '../hooks/use-tyres';
import {
  formatDotCode,
  parseDotCode,
  tyreFormSchema,
  type TyreFormValues,
} from '../schemas/tyre-form.schema';

interface TyreFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  /** Current vehicle reading, used as the default fitted odometer. */
  vehicleOdometer: number;
  /** Decides whether the position picker offers corners or a front/rear pair. */
  vehicleType: VehicleType;
  /** Corner to preselect, e.g. when fitting from an empty position. */
  defaultPosition?: TyrePosition;
  /**
   * The tyre to correct. The form then edits it in place instead of fitting a
   * new one, and its readings stay with it.
   */
  tyre?: Tyre;
}

/** A two-wheeler has one front and one rear tyre; carrying a spare is not modelled. */
const TWO_WHEEL_POSITIONS = [TyrePosition.Front, TyrePosition.Rear] as const;

/** Four corners plus the spare, unchanged from before two-wheelers were supported. */
const FOUR_WHEEL_POSITIONS = [
  TyrePosition.FrontLeft,
  TyrePosition.FrontRight,
  TyrePosition.RearLeft,
  TyrePosition.RearRight,
  TyrePosition.Spare,
] as const;

export function positionOptionsFor(
  vehicleType: VehicleType,
): readonly [TyrePosition, ...TyrePosition[]] {
  return isTwoWheeler(vehicleType) ? TWO_WHEEL_POSITIONS : FOUR_WHEEL_POSITIONS;
}

/** What was recorded for the tyre, as the form shows it. */
function valuesFromTyre(tyre: Tyre): TyreFormValues {
  return {
    position: tyre.position,
    brand: tyre.brand ?? '',
    model: tyre.model ?? '',
    size: tyre.size ?? '',
    dotCode: formatDotCode(tyre.dotWeek ?? null, tyre.dotYear ?? null),
    fittedDate: tyre.fittedDate.slice(0, 10),
    fittedOdometer: tyre.fittedOdometer,
    expectedLifeKm: tyre.expectedLifeKm ?? undefined,
    notes: tyre.notes ?? '',
  };
}

function buildDefaults(vehicleOdometer: number, defaultPosition: TyrePosition): TyreFormValues {
  return {
    position: defaultPosition,
    brand: '',
    model: '',
    size: '',
    dotCode: '',
    fittedDate: new Date().toISOString().slice(0, 10),
    fittedOdometer: vehicleOdometer,
    expectedLifeKm: undefined,
    notes: '',
  };
}

export function TyreFormDialog({
  isOpen,
  onClose,
  vehicleId,
  vehicleOdometer,
  vehicleType,
  defaultPosition,
  tyre,
}: TyreFormDialogProps) {
  const createMutation = useCreateTyre(vehicleId);
  const updateMutation = useUpdateTyre(vehicleId);
  const isPending = createMutation.isPending || updateMutation.isPending;
  const positionOptions = positionOptionsFor(vehicleType);
  const resolvedDefaultPosition = defaultPosition ?? positionOptions[0];

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TyreFormValues>({
    resolver: zodResolver(tyreFormSchema),
    defaultValues: tyre
      ? valuesFromTyre(tyre)
      : buildDefaults(vehicleOdometer, resolvedDefaultPosition),
  });

  useEffect(() => {
    if (isOpen) {
      reset(tyre ? valuesFromTyre(tyre) : buildDefaults(vehicleOdometer, resolvedDefaultPosition));
    }
  }, [isOpen, tyre, vehicleOdometer, resolvedDefaultPosition, reset]);

  async function onSubmit(values: TyreFormValues) {
    const dot = parseDotCode(values.dotCode);

    if (tyre) {
      // Position and removal are left out: moving a tyre to another corner is
      // fitting it there, which retires whatever that corner holds, and only
      // the add path does that.
      const changes: UpdateTyreInput = {
        brand: values.brand?.trim() || null,
        model: values.model?.trim() || null,
        size: values.size?.trim() || null,
        dotWeek: dot?.week ?? null,
        dotYear: dot?.year ?? null,
        fittedDate: new Date(values.fittedDate).toISOString(),
        fittedOdometer: values.fittedOdometer,
        expectedLifeKm: values.expectedLifeKm ?? null,
        notes: values.notes?.trim() || null,
      };

      try {
        await updateMutation.mutateAsync({ tyreId: tyre.id, input: changes });
        appToast.success({
          title: 'Tyre updated',
          description: `${format.enumLabel('tyrePosition', tyre.position)} tyre saved.`,
        });
        onClose();
      } catch (error) {
        appToast.error({
          title: "Couldn't update the tyre",
          description: getApiErrorMessage(error, 'Please check the details and try again.'),
        });
      }
      return;
    }

    const payload: CreateTyreInput = {
      position: values.position,
      brand: values.brand?.trim() || null,
      model: values.model?.trim() || null,
      size: values.size?.trim() || null,
      dotWeek: dot?.week ?? null,
      dotYear: dot?.year ?? null,
      // The form collects a calendar day; the contract is a full timestamp.
      fittedDate: new Date(values.fittedDate).toISOString(),
      fittedOdometer: values.fittedOdometer,
      removedDate: null,
      removedOdometer: null,
      expectedLifeKm: values.expectedLifeKm ?? null,
      notes: values.notes?.trim() || null,
    };

    try {
      await createMutation.mutateAsync(payload);
      appToast.success({
        title: 'Tyre added',
        description: `Fitted at ${format.enumLabel('tyrePosition', values.position).toLowerCase()}.`,
      });
      onClose();
    } catch (error) {
      appToast.error({
        title: "Couldn't add the tyre",
        description: getApiErrorMessage(error, 'Please check the details and try again.'),
      });
    }
  }

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={isOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tyre ? 'Edit tyre' : 'Add a tyre'}</DialogTitle>
          <DialogDescription>
            {tyre
              ? `Correct what was recorded for the ${format.enumLabel('tyrePosition', tyre.position).toLowerCase()} tyre. Its readings stay with it.`
              : 'Fitting a tyre to a corner retires whatever is already there, so a replacement or rotation stays accurate.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          {tyre ? (
            <FormField
              description="To move it to another corner, add it there as a new tyre."
              htmlFor="tyre-position"
              label="Position"
            >
              <Input
                disabled
                id="tyre-position"
                value={format.enumLabel('tyrePosition', tyre.position)}
              />
            </FormField>
          ) : (
            <FormField error={errors.position?.message} htmlFor="tyre-position" label="Position">
              <Controller
                control={control}
                name="position"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="tyre-position">
                      <SelectValue placeholder="Select a position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions.map((position) => (
                        <SelectItem key={position} value={position}>
                          {format.enumLabel('tyrePosition', position)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.brand?.message} htmlFor="tyre-brand" label="Brand">
              <Input id="tyre-brand" placeholder="Michelin" {...register('brand')} />
            </FormField>
            <FormField error={errors.model?.message} htmlFor="tyre-model" label="Model">
              <Input id="tyre-model" placeholder="Primacy 4" {...register('model')} />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.size?.message} htmlFor="tyre-size" label="Size">
              <Input id="tyre-size" placeholder="205/55 R16" {...register('size')} />
            </FormField>
            <FormField
              description="Four digits on the sidewall — week then year."
              error={errors.dotCode?.message}
              htmlFor="tyre-dot"
              label="DOT code"
            >
              <Input
                id="tyre-dot"
                inputMode="numeric"
                maxLength={4}
                placeholder="3624"
                {...register('dotCode')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={errors.fittedDate?.message}
              htmlFor="tyre-fitted-date"
              label="Fitted on"
            >
              <Input id="tyre-fitted-date" type="date" {...register('fittedDate')} />
            </FormField>
            <FormField
              error={errors.fittedOdometer?.message}
              htmlFor="tyre-fitted-odo"
              label="Odometer when fitted"
            >
              <Input
                id="tyre-fitted-odo"
                min={0}
                type="number"
                {...register('fittedOdometer', { valueAsNumber: true })}
              />
            </FormField>
          </div>

          <FormField
            description="Optional. Used to estimate remaining life until enough readings exist to measure wear."
            error={errors.expectedLifeKm?.message}
            htmlFor="tyre-life"
            label="Expected life (km)"
          >
            <Input
              id="tyre-life"
              min={1}
              placeholder="45000"
              type="number"
              {...register('expectedLifeKm', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
            />
          </FormField>

          <FormField error={errors.notes?.message} htmlFor="tyre-notes" label="Notes">
            <Textarea id="tyre-notes" rows={2} {...register('notes')} />
          </FormField>

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              {tyre
                ? updateMutation.isPending
                  ? 'Saving…'
                  : 'Save changes'
                : createMutation.isPending
                  ? 'Adding…'
                  : 'Add tyre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
