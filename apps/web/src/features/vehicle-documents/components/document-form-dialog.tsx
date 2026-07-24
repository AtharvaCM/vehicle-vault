/* eslint-disable @typescript-eslint/no-explicit-any */
// react-hook-form + Zod's discriminatedUnion don't narrow `register` calls by
// the runtime-only `kind` field. The shared fields stay typed; the per-kind
// (`policyNumber`, `warrantyNumber`, etc.) register/error accessors fall back
// to `any` until react-hook-form gains first-class discriminated-union
// support. The runtime cleanPayload + Zod resolver still validate the shape.
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
import {
  complianceNumberLabels,
  documentKindNouns,
  documentKindTitles,
  isComplianceKind,
} from '../utils/document-kind-labels';
import { appToast } from '@/lib/toast';

interface DocumentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  defaultKind?: VehicleDocumentKind;
  /** When provided, the dialog operates in edit mode. */
  editingDocument?: VehicleDocument | null;
  /**
   * Pre-fill values from a DocumentExtraction draft. Each field is
   * optional; only present values overwrite the empty defaults.
   * When present, the dialog renders an "AI-filled" banner.
   */
  initialValues?: Partial<{
    provider: string;
    policyNumber: string;
    startDate: string;
    endDate: string;
    premiumAmount: number;
    insuredValue: number;
    notes: string;
  }>;
}

/**
 * `<input type="date">` only accepts `YYYY-MM-DD` strings. Date objects
 * (or full ISO datetime strings) get coerced via `.toString()` which
 * produces something like `Sat Feb 14 2026 …` — invalid format, input
 * silently renders empty. Normalize everything here before handing to RHF.
 */
function toDateInputValue(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    // Already YYYY-MM-DD — pass through.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function buildDefaults(
  kind: VehicleDocumentKind,
  doc?: VehicleDocument | null,
  initial?: DocumentFormDialogProps['initialValues'],
): any {
  if (doc) {
    return {
      kind: doc.kind,
      provider: doc.provider,
      startDate: toDateInputValue(doc.startDate),
      endDate: toDateInputValue(doc.endDate),
      notes: doc.notes ?? '',
      // Insurance-specific
      policyNumber: doc.number ?? '',
      premiumAmount: (doc.details?.premiumAmount as number) ?? undefined,
      insuredValue: (doc.details?.insuredValue as number) ?? undefined,
      // Warranty-specific
      type: (doc.details?.type as string) ?? 'Manufacturer',
      warrantyNumber: doc.number ?? '',
      endOdometer: (doc.details?.endOdometer as number) ?? undefined,
      // Compliance-specific (registration / PUC / road tax)
      number: doc.number ?? '',
      amount: (doc.details?.amount as number) ?? undefined,
    };
  }

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const base: Record<string, unknown> = {
    kind,
    provider: '',
    startDate: toDateInputValue(new Date()),
    endDate: toDateInputValue(oneYearFromNow),
    notes: '',
    policyNumber: '',
    type: 'Manufacturer',
    number: '',
  };

  if (initial) {
    if (initial.provider) base.provider = initial.provider;
    if (initial.policyNumber) base.policyNumber = initial.policyNumber;
    if (initial.startDate) base.startDate = toDateInputValue(initial.startDate);
    if (initial.endDate) base.endDate = toDateInputValue(initial.endDate);
    if (typeof initial.premiumAmount === 'number') base.premiumAmount = initial.premiumAmount;
    if (typeof initial.insuredValue === 'number') base.insuredValue = initial.insuredValue;
    if (initial.notes) base.notes = initial.notes;
  }

  return base;
}

export function DocumentFormDialog({ isOpen, onClose, vehicleId, defaultKind = 'insurance', editingDocument, initialValues }: DocumentFormDialogProps) {
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
    formState: { errors },
  } = useForm<CreateVehicleDocumentInput>({
    resolver: zodResolver(CreateVehicleDocumentSchema),
    defaultValues: buildDefaults(defaultKind, editingDocument, initialValues),
  });

  const selectedKind = watch('kind');
  const showAiBanner = !!initialValues && !editingDocument;

  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(editingDocument?.kind ?? defaultKind, editingDocument, initialValues));
    }
  }, [isOpen, defaultKind, editingDocument, initialValues, reset]);

  function cleanPayload(data: CreateVehicleDocumentInput) {
    const cleanData = { ...data };
    if (cleanData.kind !== 'warranty') {
      delete (cleanData as any).type;
      delete (cleanData as any).warrantyNumber;
      delete (cleanData as any).endOdometer;
    }
    if (cleanData.kind !== 'insurance') {
      delete (cleanData as any).policyNumber;
      delete (cleanData as any).premiumAmount;
      delete (cleanData as any).insuredValue;
    }
    if (!isComplianceKind(cleanData.kind)) {
      delete (cleanData as any).number;
      delete (cleanData as any).amount;
    }
    return cleanData;
  }

  async function onSubmit(data: CreateVehicleDocumentInput) {
    try {
      const cleanData = cleanPayload(data);

      if (isEditing && editingDocument) {
        await updateMutation.mutateAsync({ id: editingDocument.id, data: cleanData as any });
        appToast.success({
          title: `${documentKindNouns[cleanData.kind]} updated`,
          description: 'Changes saved successfully.'
        });
      } else {
        await createMutation.mutateAsync(cleanData);
        appToast.success({
          title: `${documentKindNouns[cleanData.kind]} added`,
          description: 'Details saved successfully.'
        });
      }
      reset();
      onClose();
    } catch {
      appToast.error({ title: 'Failed to save', description: 'Please check your inputs and try again.' });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} {documentKindTitles[selectedKind]}</DialogTitle>
          <DialogDescription>
            {selectedKind === 'insurance'
              ? "Enter your vehicle's insurance details to receive renewal reminders."
              : selectedKind === 'warranty'
                ? 'Record your manufacturer or extended warranty details.'
                : 'Track this document to get an alert before it expires.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {showAiBanner && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Fields below were filled by AI from your uploaded document. Please verify before saving.
            </div>
          )}
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
                      <SelectItem value="registration">Registration Certificate</SelectItem>
                      <SelectItem value="puc">PUC Certificate</SelectItem>
                      <SelectItem value="road_tax">Road Tax</SelectItem>
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

          <FormField
            label={
              isComplianceKind(selectedKind)
                ? 'Issuing Authority'
                : selectedKind === 'insurance'
                  ? 'Provider Name'
                  : 'Provider/Brand'
            }
            htmlFor="provider"
            error={errors.provider?.message}
          >
            <Input
              {...register('provider')}
              placeholder={
                isComplianceKind(selectedKind)
                  ? 'e.g. RTO Pune (MH-12), PUC Center'
                  : selectedKind === 'insurance'
                    ? 'e.g. HDFC ERGO, ICICI Lombard'
                    : 'e.g. Hyundai, GoMechanic'
              }
            />
          </FormField>

          {selectedKind === 'insurance' && (
            <FormField label="Policy Number" htmlFor="policyNumber" error={(errors as any).policyNumber?.message}>
              <Input {...register('policyNumber' as any)} placeholder="e.g. 2314/5678/9012" />
            </FormField>
          )}
          {selectedKind === 'warranty' && (
            <FormField label="Warranty # / Certificate ID" htmlFor="warrantyNumber" error={(errors as any).warrantyNumber?.message}>
              <Input {...register('warrantyNumber' as any)} placeholder="Optional" />
            </FormField>
          )}
          {isComplianceKind(selectedKind) && (
            <FormField label={complianceNumberLabels[selectedKind]} htmlFor="number" error={(errors as any).number?.message}>
              <Input {...register('number' as any)} placeholder="Optional" />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" htmlFor="startDate" error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </FormField>
            <FormField label="End Date" htmlFor="endDate" error={errors.endDate?.message}>
              <Input type="date" {...register('endDate')} placeholder={selectedKind === 'insurance' ? undefined : 'Optional'} />
            </FormField>
          </div>

          {selectedKind === 'insurance' && (
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
          )}
          {selectedKind === 'warranty' && (
            <FormField label="End Odometer (km)" htmlFor="endOdometer" error={(errors as any).endOdometer?.message}>
              <Input
                type="number"
                {...register('endOdometer' as any, { valueAsNumber: true })}
                placeholder="e.g. 100000"
              />
            </FormField>
          )}
          {isComplianceKind(selectedKind) && (
            <FormField label="Amount Paid (₹)" htmlFor="amount" error={(errors as any).amount?.message}>
              <Input
                type="number"
                {...register('amount' as any, { valueAsNumber: true })}
                placeholder="Optional"
              />
            </FormField>
          )}

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Input {...register('notes')} placeholder={selectedKind === 'insurance' ? "Any additional details..." : "Optional comments..."} />
          </FormField>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : `Add ${documentKindNouns[selectedKind]}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
