import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  CreateClaimSchema,
  type Claim,
  type CreateClaimInput,
  type VehicleDocument,
} from '@vehicle-vault/shared';

import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';

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
  SelectValue,
} from '@/components/ui/select';
import { appToast } from '@/lib/toast';

import { useCreateClaim, useUpdateClaim } from '../hooks/use-claims';

interface ClaimFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  /** Insurance documents for this vehicle. Used to populate the policy picker. */
  insurancePolicies: VehicleDocument[];
  /** When present, dialog operates in edit mode. */
  editingClaim?: Claim | null;
  /**
   * Optional pre-selected maintenance record id (e.g. when launching the
   * dialog from the maintenance form's "create new claim" affordance).
   */
  defaultMaintenanceRecordId?: string | null;
}

type FormValues = Omit<CreateClaimInput, 'filedDate' | 'settledDate'> & {
  filedDate: string;
  settledDate?: string | null;
};

function toFormDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function buildDefaults(
  policies: VehicleDocument[],
  editing?: Claim | null,
  defaultMaintenanceRecordId?: string | null,
): FormValues {
  if (editing) {
    return {
      insurancePolicyId: editing.insurancePolicyId,
      maintenanceRecordId: editing.maintenanceRecordId ?? null,
      claimNumber: editing.claimNumber ?? '',
      grossAmount: editing.grossAmount,
      insurerPaidAmount: editing.insurerPaidAmount,
      status: editing.status,
      filedDate: toFormDate(editing.filedDate),
      settledDate: editing.settledDate ? toFormDate(editing.settledDate) : '',
      notes: editing.notes ?? '',
    };
  }

  return {
    insurancePolicyId: policies[0]?.id ?? '',
    maintenanceRecordId: defaultMaintenanceRecordId ?? null,
    claimNumber: '',
    grossAmount: 0,
    insurerPaidAmount: 0,
    status: 'filed',
    filedDate: toFormDate(new Date()),
    settledDate: '',
    notes: '',
  };
}

export function ClaimFormDialog({
  isOpen,
  onClose,
  vehicleId,
  insurancePolicies,
  editingClaim,
  defaultMaintenanceRecordId,
}: ClaimFormDialogProps) {
  const createMutation = useCreateClaim(vehicleId);
  const updateMutation = useUpdateClaim(vehicleId);
  const isEditing = !!editingClaim;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const defaults = useMemo(
    () => buildDefaults(insurancePolicies, editingClaim, defaultMaintenanceRecordId),
    [insurancePolicies, editingClaim, defaultMaintenanceRecordId],
  );

  const maintenanceRecordsQuery = useMaintenanceRecords(vehicleId);
  const maintenanceRecords = maintenanceRecordsQuery.data ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateClaimSchema) as never,
    defaultValues: defaults,
  });

  const status = watch('status');

  useEffect(() => {
    if (isOpen) reset(defaults);
  }, [isOpen, defaults, reset]);

  async function onSubmit(data: FormValues) {
    const payload: CreateClaimInput = {
      insurancePolicyId: data.insurancePolicyId,
      maintenanceRecordId: data.maintenanceRecordId || null,
      claimNumber: data.claimNumber?.trim() ? data.claimNumber.trim() : null,
      grossAmount: Number(data.grossAmount),
      insurerPaidAmount: Number(data.insurerPaidAmount),
      status: data.status,
      filedDate: new Date(data.filedDate),
      settledDate: data.settledDate ? new Date(data.settledDate) : null,
      notes: data.notes?.toString().trim() ? data.notes.toString().trim() : null,
    };

    try {
      if (isEditing && editingClaim) {
        await updateMutation.mutateAsync({ id: editingClaim.id, data: payload });
        appToast.success({ title: 'Claim updated', description: 'Changes saved.' });
      } else {
        await createMutation.mutateAsync(payload);
        appToast.success({ title: 'Claim recorded', description: 'Filed under selected policy.' });
      }
      reset();
      onClose();
    } catch {
      appToast.error({
        title: 'Failed to save claim',
        description: 'Check the values and try again.',
      });
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Insurance Claim' : 'Record Insurance Claim'}</DialogTitle>
          <DialogDescription>
            Track the gross bill, what the insurer paid, and your out-of-pocket. Link the
            related maintenance record when you have one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField label="Policy" htmlFor="insurancePolicyId" error={errors.insurancePolicyId?.message}>
            <Controller
              control={control}
              name="insurancePolicyId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {insurancePolicies.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Add an insurance policy first
                      </SelectItem>
                    ) : (
                      insurancePolicies.map((policy) => (
                        <SelectItem key={policy.id} value={policy.id}>
                          {policy.provider} {policy.number ? `· ${policy.number}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Linked Maintenance Record (optional)"
            htmlFor="maintenanceRecordId"
            error={errors.maintenanceRecordId?.message}
          >
            <Controller
              control={control}
              name="maintenanceRecordId"
              render={({ field }) => (
                <Select
                  onValueChange={(v) => field.onChange(v === '__none' ? null : v)}
                  value={field.value ?? '__none'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No maintenance record linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No maintenance record linked</SelectItem>
                    {maintenanceRecords.map((record) => (
                      <SelectItem key={record.id} value={record.id}>
                        {format(new Date(record.serviceDate), 'd MMM yyyy')} ·{' '}
                        {record.workshopName ?? record.category} · ₹{Math.round(record.totalCost)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField label="Insurer Claim Number" htmlFor="claimNumber" error={errors.claimNumber?.message}>
            <Input {...register('claimNumber')} placeholder="Leave blank if not yet assigned" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Gross Bill (₹)" htmlFor="grossAmount" error={errors.grossAmount?.message}>
              <Input
                type="number"
                step="0.01"
                {...register('grossAmount', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              label="Insurer Paid (₹)"
              htmlFor="insurerPaidAmount"
              error={errors.insurerPaidAmount?.message}
            >
              <Input
                type="number"
                step="0.01"
                {...register('insurerPaidAmount', { valueAsNumber: true })}
              />
            </FormField>
          </div>

          <FormField label="Status" htmlFor="status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filed">Filed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Filed Date" htmlFor="filedDate" error={errors.filedDate?.message}>
              <Input type="date" {...register('filedDate')} />
            </FormField>
            <FormField label="Settled Date" htmlFor="settledDate" error={errors.settledDate?.message}>
              <Input
                type="date"
                {...register('settledDate')}
                placeholder={status === 'settled' ? 'Required when settled' : 'Optional'}
              />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Input
              {...register('notes')}
              placeholder="Surveyor, garage, accident description, etc."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || insurancePolicies.length === 0}>
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Record Claim'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
