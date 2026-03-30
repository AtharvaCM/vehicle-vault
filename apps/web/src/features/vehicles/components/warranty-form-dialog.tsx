import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateWarrantySchema,
  type CreateWarrantyInput,
} from '@vehicle-vault/shared';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useCreateWarranty } from '../hooks/use-warranty';
import { appToast } from '@/lib/toast';

interface WarrantyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
}

export function WarrantyFormDialog({ isOpen, onClose, vehicleId }: WarrantyFormDialogProps) {
  const createMutation = useCreateWarranty(vehicleId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateWarrantyInput>({
    resolver: zodResolver(CreateWarrantySchema),
    defaultValues: {
      provider: '',
      type: 'Manufacturer',
      startDate: new Date(),
      endDate: undefined,
      endOdometer: undefined,
      notes: '',
    },
  });

  async function onSubmit(data: CreateWarrantyInput) {
    try {
      await createMutation.mutateAsync(data);
      appToast.success({ title: 'Warranty added', description: 'Coverage details saved successfully.' });
      reset();
      onClose();
    } catch (error) {
      appToast.error({ title: 'Failed to add warranty', description: 'Please check your inputs and try again.' });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Warranty Coverage</DialogTitle>
          <DialogDescription>
            Record your manufacturer or extended warranty details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Warranty Type" htmlFor="type" error={errors.type?.message}>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="Extended">Extended</SelectItem>
                      <SelectItem value="Parts">Parts Only</SelectItem>
                      <SelectItem value="Service">Service Plan</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Provider/Brand" htmlFor="provider" error={errors.provider?.message}>
              <Input {...register('provider')} placeholder="e.g. Hyundai, GoMechanic" />
            </FormField>
          </div>

          <FormField label="Warranty # / Certificate ID" htmlFor="warrantyNumber" error={errors.warrantyNumber?.message}>
            <Input {...register('warrantyNumber')} placeholder="Optional" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" htmlFor="startDate" error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </FormField>
            <FormField label="End Date" htmlFor="endDate" error={errors.endDate?.message}>
              <Input type="date" {...register('endDate')} placeholder="Optional" />
            </FormField>
          </div>

          <FormField label="End Odometer (km)" htmlFor="endOdometer" error={errors.endOdometer?.message}>
            <Input 
              type="number" 
              {...register('endOdometer', { valueAsNumber: true })} 
              placeholder="e.g. 100000" 
            />
          </FormField>

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Input {...register('notes')} placeholder="Optional comments..." />
          </FormField>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Add Warranty'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
