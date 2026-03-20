import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  type CreateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { useEffect, useState } from 'react';
import { Controller, type Path, useForm } from 'react-hook-form';

import { ApiError } from '@/lib/api/api-error';
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
  isSubmitting?: boolean;
  onSubmit: (values: CreateMaintenanceRecordBody) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<MaintenanceFormValues>;
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
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  submitLabel = 'Save Record',
  submittingLabel = 'Saving record...',
  submitHint = 'The record is stored immediately after submit.',
  successMessage = 'Maintenance record saved successfully.',
}: MaintenanceFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance record</CardTitle>
        <CardDescription>
          Keep maintenance inputs scoped to this feature so list, detail, and create flows stay
          aligned.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
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
              label="Workshop name"
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
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {submissionState}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button disabled={form.formState.isSubmitting || isSubmitting} type="submit">
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
            <p className="text-sm text-slate-500">
              {isSubmitting ? 'Submitting maintenance record to the API...' : submitHint}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
