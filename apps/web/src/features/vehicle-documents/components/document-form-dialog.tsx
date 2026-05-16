import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateVehicleDocumentSchema,
  type CreateVehicleDocumentInput,
  type VehicleDocument,
  type VehicleDocumentKind,
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
import { useCreateVehicleDocument, useUpdateVehicleDocument } from '../hooks/use-documents';
import { appToast } from '@/lib/toast';

interface DocumentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  defaultKind?: VehicleDocumentKind;
  /** When provided, the dialog operates in edit mode. */
  editingDocument?: VehicleDocument | null;
}

function buildDefaults(kind: VehicleDocumentKind, doc?: VehicleDocument | null): any {
  if (doc) {
    return {
      kind: doc.kind,
      provider: doc.provider,
      startDate: doc.startDate,
      endDate: doc.endDate ?? undefined,
      notes: doc.notes ?? '',
      // Insurance-specific
      policyNumber: doc.number ?? '',
      premiumAmount: (doc.details?.premiumAmount as number) ?? undefined,
      insuredValue: (doc.details?.insuredValue as number) ?? undefined,
      // Warranty-specific
      type: (doc.details?.type as string) ?? 'Manufacturer',
      warrantyNumber: doc.number ?? '',
      endOdometer: (doc.details?.endOdometer as number) ?? undefined,
    };
  }

  return {
    kind,
    provider: '',
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    notes: '',
    policyNumber: '',
    type: 'Manufacturer',
  };
}

export function DocumentFormDialog({ isOpen, onClose, vehicleId, defaultKind = 'insurance', editingDocument }: DocumentFormDialogProps) {
  const createMutation = useCreateVehicleDocument(vehicleId);
  const updateMutation = useUpdateVehicleDocument(vehicleId);
  const isEditing = !!editingDocument;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateVehicleDocumentInput>({
    resolver: zodResolver(CreateVehicleDocumentSchema),
    defaultValues: buildDefaults(defaultKind, editingDocument),
  });

  const selectedKind = watch('kind');

  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(editingDocument?.kind ?? defaultKind, editingDocument));
    }
  }, [isOpen, defaultKind, editingDocument, reset]);

  function cleanPayload(data: CreateVehicleDocumentInput) {
    const cleanData = { ...data };
    if (cleanData.kind === 'insurance') {
      delete (cleanData as any).type;
      delete (cleanData as any).warrantyNumber;
      delete (cleanData as any).endOdometer;
    } else {
      delete (cleanData as any).policyNumber;
      delete (cleanData as any).premiumAmount;
      delete (cleanData as any).insuredValue;
    }
    return cleanData;
  }

  async function onSubmit(data: CreateVehicleDocumentInput) {
    try {
      const cleanData = cleanPayload(data);

      if (isEditing && editingDocument) {
        await updateMutation.mutateAsync({ id: editingDocument.id, data: cleanData as any });
        appToast.success({ 
          title: `${cleanData.kind === 'insurance' ? 'Policy' : 'Warranty'} updated`, 
          description: 'Changes saved successfully.' 
        });
      } else {
        await createMutation.mutateAsync(cleanData);
        appToast.success({ 
          title: `${cleanData.kind === 'insurance' ? 'Policy' : 'Warranty'} added`, 
          description: 'Details saved successfully.' 
        });
      }
      reset();
      onClose();
    } catch (error) {
      appToast.error({ title: 'Failed to save', description: 'Please check your inputs and try again.' });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} {selectedKind === 'insurance' ? 'Insurance Policy' : 'Warranty Coverage'}</DialogTitle>
          <DialogDescription>
            {selectedKind === 'insurance' 
              ? "Enter your vehicle's insurance details to receive renewal reminders."
              : "Record your manufacturer or extended warranty details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {!isEditing && (
            <FormField label="Document Type" htmlFor="kind">
              <Controller
                control={control}
                name="kind"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insurance">Insurance Policy</SelectItem>
                      <SelectItem value="warranty">Warranty Coverage</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}

          {selectedKind === 'warranty' && (
            <FormField label="Warranty Type" htmlFor="type" error={(errors as any).type?.message}>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'Manufacturer'}>
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
          )}

          <FormField label={selectedKind === 'insurance' ? 'Provider Name' : 'Provider/Brand'} htmlFor="provider" error={errors.provider?.message}>
            <Input {...register('provider')} placeholder={selectedKind === 'insurance' ? "e.g. HDFC ERGO, ICICI Lombard" : "e.g. Hyundai, GoMechanic"} />
          </FormField>

          {selectedKind === 'insurance' ? (
            <FormField label="Policy Number" htmlFor="policyNumber" error={(errors as any).policyNumber?.message}>
              <Input {...register('policyNumber' as any)} placeholder="e.g. 2314/5678/9012" />
            </FormField>
          ) : (
            <FormField label="Warranty # / Certificate ID" htmlFor="warrantyNumber" error={(errors as any).warrantyNumber?.message}>
              <Input {...register('warrantyNumber' as any)} placeholder="Optional" />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" htmlFor="startDate" error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </FormField>
            <FormField label="End Date" htmlFor="endDate" error={errors.endDate?.message}>
              <Input type="date" {...register('endDate')} placeholder={selectedKind === 'warranty' ? 'Optional' : undefined} />
            </FormField>
          </div>

          {selectedKind === 'insurance' ? (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Premium Amount (₹)" htmlFor="premiumAmount" error={(errors as any).premiumAmount?.message}>
                <Input 
                  type="number" 
                  {...register('premiumAmount' as any, { valueAsNumber: true })} 
                  placeholder="Optional" 
                />
              </FormField>
              <FormField label="Insured Value (IDV) (₹)" htmlFor="insuredValue" error={(errors as any).insuredValue?.message}>
                <Input 
                  type="number" 
                  {...register('insuredValue' as any, { valueAsNumber: true })} 
                  placeholder="Optional" 
                />
              </FormField>
            </div>
          ) : (
            <FormField label="End Odometer (km)" htmlFor="endOdometer" error={(errors as any).endOdometer?.message}>
              <Input 
                type="number" 
                {...register('endOdometer' as any, { valueAsNumber: true })} 
                placeholder="e.g. 100000" 
              />
            </FormField>
          )}

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Input {...register('notes')} placeholder={selectedKind === 'insurance' ? "Any additional details..." : "Optional comments..."} />
          </FormField>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : `${isEditing ? 'Save Changes' : `Add ${selectedKind === 'insurance' ? 'Policy' : 'Warranty'}`}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
