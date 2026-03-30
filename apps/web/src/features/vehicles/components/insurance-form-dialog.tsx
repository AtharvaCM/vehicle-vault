import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateInsurancePolicySchema,
  type CreateInsurancePolicyInput,
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
import { useCreateInsurancePolicy } from '../hooks/use-insurance';
import { appToast } from '@/lib/toast';

interface InsuranceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
}

export function InsuranceFormDialog({ isOpen, onClose, vehicleId }: InsuranceFormDialogProps) {
  const createMutation = useCreateInsurancePolicy(vehicleId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInsurancePolicyInput>({
    resolver: zodResolver(CreateInsurancePolicySchema),
    defaultValues: {
      provider: '',
      policyNumber: '',
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      notes: '',
    },
  });

  async function onSubmit(data: CreateInsurancePolicyInput) {
    try {
      await createMutation.mutateAsync(data);
      appToast.success({ title: 'Policy added', description: 'Insurance details saved successfully.' });
      reset();
      onClose();
    } catch (error) {
      appToast.error({ title: 'Failed to add policy', description: 'Please check your inputs and try again.' });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Insurance Policy</DialogTitle>
          <DialogDescription>
            Enter your vehicle's insurance details to receive renewal reminders.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField label="Provider Name" htmlFor="provider" error={errors.provider?.message}>
            <Input {...register('provider')} placeholder="e.g. HDFC ERGO, ICICI Lombard" />
          </FormField>

          <FormField label="Policy Number" htmlFor="policyNumber" error={errors.policyNumber?.message}>
            <Input {...register('policyNumber')} placeholder="e.g. 2314/5678/9012" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" htmlFor="startDate" error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </FormField>
            <FormField label="End Date" htmlFor="endDate" error={errors.endDate?.message}>
              <Input type="date" {...register('endDate')} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Premium Amount (₹)" htmlFor="premiumAmount" error={errors.premiumAmount?.message}>
              <Input 
                type="number" 
                {...register('premiumAmount', { valueAsNumber: true })} 
                placeholder="Optional" 
              />
            </FormField>
            <FormField label="Insured Value (IDV) (₹)" htmlFor="insuredValue" error={errors.insuredValue?.message}>
              <Input 
                type="number" 
                {...register('insuredValue', { valueAsNumber: true })} 
                placeholder="Optional" 
              />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Input {...register('notes')} placeholder="Any additional details..." />
          </FormField>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Add Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
