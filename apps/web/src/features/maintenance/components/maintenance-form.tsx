import { useQuery } from '@tanstack/react-query';
import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  type CreateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { Sparkles, Clock, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, type Path, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { vehicleForecastQueryOptions } from '@/features/vehicles/api/get-vehicle-forecast';
import { ApiError } from '@/lib/api/api-error';

import {
  maintenanceFormSchema,
  type MaintenanceFormValues,
} from '../schemas/maintenance-form.schema';
import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

const categoryOptions = Object.values(MaintenanceCategory);
const defaultMaintenanceValues: MaintenanceFormValues = {
  serviceDate: '',
  odometer: 0,
  category: MaintenanceCategory.PeriodicService,
  workshopName: '',
  totalCost: 0,
  notes: '',
  nextDueDate: '',
  nextDueOdometer: undefined,
};

type MaintenanceFormProps = {
  vehicleId?: string;
  isSubmitting?: boolean;
  onSubmit: (values: CreateMaintenanceRecordBody) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<MaintenanceFormValues>;
  onDirtyChange?: (isDirty: boolean) => void;
  submitLabel?: string;
  submittingLabel?: string;
  submitHint?: string;
  successMessage?: string;
};

function toIsoDateString(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toCreateMaintenanceRecordInput(
  values: MaintenanceFormValues,
): CreateMaintenanceRecordInput {
  return {
    vehicleId: 'vehicle-id-is-provided-by-route',
    serviceDate: toIsoDateString(values.serviceDate) ?? '',
    odometer: values.odometer,
    category: values.category,
    workshopName: values.workshopName?.trim() ? values.workshopName.trim() : undefined,
    totalCost: values.totalCost,
    notes: values.notes?.trim() ? values.notes.trim() : undefined,
    nextDueDate: toIsoDateString(values.nextDueDate),
    nextDueOdometer: values.nextDueOdometer,
  };
}

export function MaintenanceForm({
  vehicleId,
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  onDirtyChange,
  submitLabel = 'Save Record',
  submittingLabel = 'Saving record...',
  submitHint = 'Use this record for one completed service, repair, or inspection.',
  successMessage = 'Maintenance record saved.',
}: MaintenanceFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);

  const forecastQuery = useQuery(vehicleForecastQueryOptions(vehicleId || ''));

  const form = useForm<MaintenanceFormValues>({
    defaultValues: defaultMaintenanceValues,
  });

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

  useEffect(() => {
    form.reset({
      ...defaultMaintenanceValues,
      ...initialValues,
    });
  }, [form, initialValues]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const localResult = maintenanceFormSchema.safeParse(values);

    if (!localResult.success) {
      localResult.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<MaintenanceFormValues>, {
            message: issue.message,
          });
        }
      });

      setSubmissionState(null);
      return;
    }

    const contractResult = MaintenanceRecordCreateSchema.omit({ vehicleId: true }).safeParse(
      toCreateMaintenanceRecordInput(localResult.data),
    );

    if (!contractResult.success) {
      contractResult.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<MaintenanceFormValues>, {
            message: issue.message,
          });
        }
      });

      setSubmissionState(null);
      return;
    }

    try {
      await onSubmit(contractResult.data);
      setSubmissionState(successMessage);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmissionState(null);
        return;
      }

      setSubmissionState(null);
    }
  });

  const suggestions = forecastQuery.data || [];

  return (
    <div className="space-y-6">
      {suggestions.length > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-semibold text-indigo-900">Smart Suggestions</CardTitle>
            </div>
            <CardDescription className="text-xs text-indigo-700">
              Based on your vehicle's usage trend, you might need these services soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.category}
                  className="flex flex-col rounded-lg border border-indigo-100 bg-white p-3 shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 uppercase">
                      {suggestion.category.replace('_', ' ')}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      suggestion.priority === 'high' ? 'bg-red-100 text-red-700' :
                      suggestion.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {suggestion.priority} priority
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-slate-600 leading-relaxed">
                    {suggestion.reason}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      {suggestion.estimatedOdometerDue && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="h-2.5 w-2.5" />
                          <span>~{suggestion.estimatedOdometerDue} km</span>
                        </div>
                      )}
                      {suggestion.estimatedDateDue && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Calendar className="h-2.5 w-2.5" />
                          <span>~{new Date(suggestion.estimatedDateDue).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                      onClick={() => {
                        form.setValue('category', suggestion.category, { shouldDirty: true });
                        form.setValue('notes', suggestion.reason, { shouldDirty: true });
                        toast.info(`Applied ${suggestion.category.replace('_', ' ')} suggestion`);
                      }}
                    >
                      Quick Apply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Maintenance record</CardTitle>
          <CardDescription>
            Capture the details of one completed service visit, repair, or inspection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Common Tasks</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Oil Change', category: MaintenanceCategory.EngineOil, note: 'Engine oil and filter replacement' },
                { label: 'Periodic Service', category: MaintenanceCategory.PeriodicService, note: 'Full vehicle inspection and service' },
                { label: 'Brake Service', category: MaintenanceCategory.BrakePads, note: 'Brake pad inspection/replacement' },
                { label: 'Tyre Rotation', category: MaintenanceCategory.TyreRotation, note: 'Wheel rotation and alignment check' },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-slate-200 bg-slate-50 text-xs hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => {
                    form.setValue('category', preset.category, { shouldDirty: true });
                    form.setValue('notes', preset.note, { shouldDirty: true });
                    toast.info(`Applied ${preset.label} preset`);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-3.5 md:grid-cols-2">
              <FormField
                htmlFor="maintenance-service-date"
                label="Service date"
                error={form.formState.errors.serviceDate?.message}
              >
                <Input
                  id="maintenance-service-date"
                  {...form.register('serviceDate')}
                  aria-invalid={Boolean(form.formState.errors.serviceDate)}
                  type="date"
                />
              </FormField>

              <FormField
                htmlFor="maintenance-odometer"
                label="Odometer"
                error={form.formState.errors.odometer?.message}
              >
                <Input
                  id="maintenance-odometer"
                  {...form.register('odometer', { valueAsNumber: true })}
                  aria-invalid={Boolean(form.formState.errors.odometer)}
                  min={0}
                  type="number"
                />
              </FormField>

              <FormField
                htmlFor="maintenance-category"
                label="Category"
                error={form.formState.errors.category?.message}
              >
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger
                        id="maintenance-category"
                        aria-invalid={Boolean(form.formState.errors.category)}
                      >
                        <SelectValue placeholder="Select a maintenance category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>
                            {formatMaintenanceCategory(category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField
                htmlFor="maintenance-workshop-name"
                label="Workshop or garage"
                error={form.formState.errors.workshopName?.message}
              >
                <Input
                  id="maintenance-workshop-name"
                  {...form.register('workshopName')}
                  aria-invalid={Boolean(form.formState.errors.workshopName)}
                  placeholder="Authorized service centre"
                />
              </FormField>

              <FormField
                htmlFor="maintenance-total-cost"
                label="Total cost"
                error={form.formState.errors.totalCost?.message}
              >
                <Input
                  id="maintenance-total-cost"
                  {...form.register('totalCost', { valueAsNumber: true })}
                  aria-invalid={Boolean(form.formState.errors.totalCost)}
                  min={0}
                  step="0.01"
                  type="number"
                />
              </FormField>

              <FormField
                htmlFor="maintenance-next-due-date"
                label="Next due date"
                error={form.formState.errors.nextDueDate?.message}
              >
                <Input
                  id="maintenance-next-due-date"
                  {...form.register('nextDueDate')}
                  aria-invalid={Boolean(form.formState.errors.nextDueDate)}
                  type="date"
                />
              </FormField>

              <FormField
                htmlFor="maintenance-next-due-odometer"
                label="Next due odometer"
                error={form.formState.errors.nextDueOdometer?.message}
              >
                <Input
                  id="maintenance-next-due-odometer"
                  {...form.register('nextDueOdometer', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                  aria-invalid={Boolean(form.formState.errors.nextDueOdometer)}
                  min={0}
                  type="number"
                />
              </FormField>
            </div>

            <FormField
              htmlFor="maintenance-notes"
              label="Notes"
              error={form.formState.errors.notes?.message}
            >
              <Textarea
                id="maintenance-notes"
                {...form.register('notes')}
                aria-invalid={Boolean(form.formState.errors.notes)}
                placeholder="Service details, parts replaced, or follow-up actions"
              />
            </FormField>

            {submitError ? <InlineError message={submitError} /> : null}

            {submissionState ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm leading-5 text-emerald-700">
                {submissionState}
              </p>
            ) : null}

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button disabled={form.formState.isSubmitting || isSubmitting} size="sm" type="submit">
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
              <p className="text-sm leading-5 text-slate-500 sm:max-w-md">
                {isSubmitting ? 'Saving maintenance record...' : submitHint}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
