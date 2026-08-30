import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Accessory, CreateAccessoryInput } from '@vehicle-vault/shared';

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

import { useCreateAccessory, useUpdateAccessory } from '../hooks/use-accessories';
import {
  accessoryFormSchema,
  toDateInputValue,
  toIsoDate,
  type AccessoryFormValues,
} from '../schemas/accessory-form.schema';

interface AccessoryFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  /** Present when editing; absent when adding. */
  editingAccessory?: Accessory | null;
}

function buildDefaults(editing?: Accessory | null): AccessoryFormValues {
  if (!editing) {
    return {
      name: '',
      brand: '',
      category: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      cost: 0,
      fittedDate: '',
      fittedOdometer: undefined,
      removedDate: '',
      removedOdometer: undefined,
      warrantyExpiresAt: '',
      notes: '',
    };
  }

  return {
    name: editing.name,
    brand: editing.brand ?? '',
    category: editing.category ?? '',
    purchaseDate: toDateInputValue(editing.purchaseDate),
    cost: editing.cost,
    fittedDate: toDateInputValue(editing.fittedDate),
    fittedOdometer: editing.fittedOdometer ?? undefined,
    removedDate: toDateInputValue(editing.removedDate),
    removedOdometer: editing.removedOdometer ?? undefined,
    warrantyExpiresAt: toDateInputValue(editing.warrantyExpiresAt),
    notes: editing.notes ?? '',
  };
}

function toPayload(values: AccessoryFormValues): CreateAccessoryInput {
  return {
    name: values.name.trim(),
    brand: values.brand?.trim() || null,
    category: values.category?.trim() || null,
    // The form collects a calendar day; the contract is a full timestamp.
    purchaseDate: toIsoDate(values.purchaseDate)!,
    cost: values.cost,
    fittedDate: toIsoDate(values.fittedDate),
    fittedOdometer: values.fittedOdometer ?? null,
    removedDate: toIsoDate(values.removedDate),
    removedOdometer: values.removedOdometer ?? null,
    warrantyExpiresAt: toIsoDate(values.warrantyExpiresAt),
    notes: values.notes?.trim() || null,
  };
}

export function AccessoryFormDialog({
  isOpen,
  onClose,
  vehicleId,
  editingAccessory,
}: AccessoryFormDialogProps) {
  const createMutation = useCreateAccessory(vehicleId);
  const updateMutation = useUpdateAccessory(vehicleId);
  const isEditing = Boolean(editingAccessory);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<AccessoryFormValues>({
    resolver: zodResolver(accessoryFormSchema),
    defaultValues: buildDefaults(editingAccessory),
  });

  // The dialog does not remount between opens, so without this the second row
  // you edit shows the first row's values.
  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(editingAccessory));
    }
  }, [isOpen, editingAccessory, reset]);

  async function onSubmit(values: AccessoryFormValues) {
    const payload = toPayload(values);

    try {
      if (editingAccessory) {
        await updateMutation.mutateAsync({ id: editingAccessory.id, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      appToast.success({
        title: isEditing ? 'Accessory updated' : 'Accessory added',
        description: `${payload.name} saved against this vehicle.`,
      });
      onClose();
    } catch (error) {
      appToast.error({
        title: isEditing ? "Couldn't update the accessory" : "Couldn't add the accessory",
        description: getApiErrorMessage(error, 'Please check the details and try again.'),
      });
    }
  }

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={isOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit accessory' : 'Add an accessory'}</DialogTitle>
          <DialogDescription>
            Something bought for this vehicle — mats, a dashcam, alloys. Kept apart from
            service history so it does not distort your running cost.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField error={errors.name?.message} htmlFor="accessory-name" label="Name">
            <Input id="accessory-name" placeholder="Dashcam" {...register('name')} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.brand?.message} htmlFor="accessory-brand" label="Brand">
              <Input id="accessory-brand" placeholder="70mai" {...register('brand')} />
            </FormField>
            <FormField
              description="Your own label — anything you would group by."
              error={errors.category?.message}
              htmlFor="accessory-category"
              label="Category"
            >
              <Input
                id="accessory-category"
                placeholder="Electronics"
                {...register('category')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={errors.purchaseDate?.message}
              htmlFor="accessory-purchase-date"
              label="Purchase date"
            >
              <Input
                id="accessory-purchase-date"
                type="date"
                {...register('purchaseDate')}
              />
            </FormField>
            <FormField error={errors.cost?.message} htmlFor="accessory-cost" label="Cost">
              <Input
                id="accessory-cost"
                min={0}
                step="0.01"
                type="number"
                {...register('cost', {
                  // valueAsNumber turns a cleared field into NaN, which surfaces
                  // zod's raw "expected number, received nan" at the user.
                  setValueAs: (value) => (value === '' ? Number.NaN : Number(value)),
                })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              description="Leave blank if it is not on the vehicle yet."
              error={errors.fittedDate?.message}
              htmlFor="accessory-fitted-date"
              label="Fitted date"
            >
              <Input id="accessory-fitted-date" type="date" {...register('fittedDate')} />
            </FormField>
            <FormField
              error={errors.fittedOdometer?.message}
              htmlFor="accessory-fitted-odometer"
              label="Fitted odometer"
            >
              <Input
                id="accessory-fitted-odometer"
                min={0}
                type="number"
                {...register('fittedOdometer', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              description="Set this when the item comes off."
              error={errors.removedDate?.message}
              htmlFor="accessory-removed-date"
              label="Removed date"
            >
              <Input id="accessory-removed-date" type="date" {...register('removedDate')} />
            </FormField>
            <FormField
              error={errors.removedOdometer?.message}
              htmlFor="accessory-removed-odometer"
              label="Removed odometer"
            >
              <Input
                id="accessory-removed-odometer"
                min={0}
                type="number"
                {...register('removedOdometer', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </FormField>
          </div>

          <FormField
            description="You get a heads-up a week before this date."
            error={errors.warrantyExpiresAt?.message}
            htmlFor="accessory-warranty"
            label="Warranty expires"
          >
            <Input id="accessory-warranty" type="date" {...register('warrantyExpiresAt')} />
          </FormField>

          <FormField error={errors.notes?.message} htmlFor="accessory-notes" label="Notes">
            <Textarea id="accessory-notes" rows={3} {...register('notes')} />
          </FormField>

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isEditing ? 'Save changes' : 'Add accessory'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
