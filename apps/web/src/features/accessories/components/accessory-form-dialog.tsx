import { useEffect, useState } from 'react';
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
import { confirm } from '@/components/shared/confirm';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import {
  useCreateAccessory,
  useDeleteAccessory,
  useUpdateAccessory,
  useUploadAccessoryReceipt,
} from '../hooks/use-accessories';
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
  /** Offers Delete while editing; the caller decides who may. */
  canDelete?: boolean;
}

function buildDefaults(editing?: Accessory | null): AccessoryFormValues {
  if (!editing) {
    return {
      name: '',
      brand: '',
      category: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      cost: undefined as unknown as number,
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
  canDelete = false,
}: AccessoryFormDialogProps) {
  const createMutation = useCreateAccessory(vehicleId);
  const updateMutation = useUpdateAccessory(vehicleId);
  const deleteMutation = useDeleteAccessory(vehicleId);
  const uploadReceipt = useUploadAccessoryReceipt(vehicleId);
  const isEditing = Boolean(editingAccessory);
  // Optional, and sent after the accessory is saved: a receipt needs its id.
  const [receipt, setReceipt] = useState<File | null>(null);

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
      setReceipt(null);
    }
  }, [isOpen, editingAccessory, reset]);

  async function onSubmit(values: AccessoryFormValues) {
    const payload = toPayload(values);

    let saved: Accessory;
    try {
      saved = editingAccessory
        ? await updateMutation.mutateAsync({ id: editingAccessory.id, input: payload })
        : await createMutation.mutateAsync(payload);
    } catch (error) {
      appToast.error({
        title: isEditing ? "Couldn't update the accessory" : "Couldn't add the accessory",
        description: getApiErrorMessage(error, 'Please check the details and try again.'),
      });
      return;
    }

    if (receipt) {
      try {
        await uploadReceipt.mutateAsync({ accessoryId: saved.id, file: receipt });
      } catch (error) {
        // The accessory is saved either way; say the receipt is what failed.
        appToast.error({
          title: `${payload.name} saved, but the receipt didn't upload`,
          description: getApiErrorMessage(error, 'Open it from History and add it again.'),
        });
        onClose();
        return;
      }
    }

    appToast.success({
      title: isEditing ? 'Accessory updated' : 'Accessory added',
      description: `${payload.name} saved against this vehicle.`,
    });
    onClose();
  }

  async function onDelete() {
    if (!editingAccessory) return;
    const confirmed = await confirm({
      title: `Delete ${editingAccessory.name}?`,
      description: 'Its receipt goes with it. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(editingAccessory.id);
      appToast.success({
        title: 'Accessory deleted',
        description: `${editingAccessory.name} removed.`,
      });
      onClose();
    } catch (error) {
      appToast.error({
        title: "Couldn't delete the accessory",
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    }
  }

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={isOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit accessory' : 'Add an accessory'}</DialogTitle>
          <DialogDescription>
            Something bought for this vehicle — mats, a dashcam, alloys. It shows in History, and
            stays out of your running cost per km.
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
              <Input id="accessory-category" placeholder="Electronics" {...register('category')} />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={errors.purchaseDate?.message}
              htmlFor="accessory-purchase-date"
              label="Purchase date"
            >
              <Input id="accessory-purchase-date" type="date" {...register('purchaseDate')} />
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

          <FormField
            description="Optional: a photo or PDF of the bill."
            htmlFor="accessory-receipt"
            label={isEditing ? 'Add a receipt' : 'Receipt'}
          >
            <Input
              accept="image/*,application/pdf"
              capture="environment"
              id="accessory-receipt"
              onChange={(event) => setReceipt(event.currentTarget.files?.[0] ?? null)}
              type="file"
            />
          </FormField>

          <DialogFooter className="gap-2">
            {isEditing && canDelete ? (
              <Button
                className="text-late sm:mr-auto"
                disabled={deleteMutation.isPending}
                onClick={() => void onDelete()}
                type="button"
                variant="ghost"
              >
                Delete
              </Button>
            ) : null}
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
