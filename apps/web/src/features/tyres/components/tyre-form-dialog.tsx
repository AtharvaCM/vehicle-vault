import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TyrePosition, type CreateTyreInput } from '@vehicle-vault/shared';

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
import { appToast } from '@/lib/toast';

import { useCreateTyre } from '../hooks/use-tyres';
import {
  parseDotCode,
  tyreFormSchema,
  type TyreFormValues,
} from '../schemas/tyre-form.schema';
import { POSITION_LABEL } from '../utils/tyre-labels';

interface TyreFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  /** Current vehicle reading, used as the default fitted odometer. */
  vehicleOdometer: number;
  /** Corner to preselect, e.g. when fitting from an empty position. */
  defaultPosition?: TyrePosition;
}

function buildDefaults(
  vehicleOdometer: number,
  defaultPosition: TyrePosition,
): TyreFormValues {
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
  defaultPosition = TyrePosition.FrontLeft,
}: TyreFormDialogProps) {
  const createMutation = useCreateTyre(vehicleId);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TyreFormValues>({
    resolver: zodResolver(tyreFormSchema),
    defaultValues: buildDefaults(vehicleOdometer, defaultPosition),
  });

  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(vehicleOdometer, defaultPosition));
    }
  }, [isOpen, vehicleOdometer, defaultPosition, reset]);

  async function onSubmit(values: TyreFormValues) {
    const dot = parseDotCode(values.dotCode);

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
        description: `Fitted at ${POSITION_LABEL[values.position].toLowerCase()}.`,
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
          <DialogTitle>Add a tyre</DialogTitle>
          <DialogDescription>
            Fitting a tyre to a corner retires whatever is already there, so a
            replacement or rotation stays accurate.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
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
                    {Object.values(TyrePosition).map((position) => (
                      <SelectItem key={position} value={position}>
                        {POSITION_LABEL[position]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

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
            <Button disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? 'Adding…' : 'Add tyre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
