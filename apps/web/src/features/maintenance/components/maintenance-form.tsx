import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  type CreateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { ApiError } from '@/lib/api/api-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  maintenanceFormSchema,
  type MaintenanceFormValues,
} from '../schemas/maintenance-form.schema';
import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

const categoryOptions = Object.values(MaintenanceCategory);

type MaintenanceFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: CreateMaintenanceRecordBody) => Promise<void> | void;
  submitError?: string | null;
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
}: MaintenanceFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);

  const form = useForm<MaintenanceFormValues>({
    defaultValues: {
      serviceDate: '',
      odometer: 0,
      category: MaintenanceCategory.PeriodicService,
      workshopName: '',
      totalCost: 0,
      notes: '',
      nextDueDate: '',
      nextDueOdometer: undefined,
    },
  });

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

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
      setSubmissionState('Maintenance record created successfully.');
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
            <Field label="Service date" error={form.formState.errors.serviceDate?.message}>
              <Input {...form.register('serviceDate')} type="date" />
            </Field>

            <Field label="Odometer" error={form.formState.errors.odometer?.message}>
              <Input
                {...form.register('odometer', { valueAsNumber: true })}
                min={0}
                type="number"
              />
            </Field>

            <Field label="Category" error={form.formState.errors.category?.message}>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                {...form.register('category')}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {formatMaintenanceCategory(category)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Workshop name" error={form.formState.errors.workshopName?.message}>
              <Input {...form.register('workshopName')} placeholder="Authorized service centre" />
            </Field>

            <Field label="Total cost" error={form.formState.errors.totalCost?.message}>
              <Input
                {...form.register('totalCost', { valueAsNumber: true })}
                min={0}
                step="0.01"
                type="number"
              />
            </Field>

            <Field label="Next due date" error={form.formState.errors.nextDueDate?.message}>
              <Input {...form.register('nextDueDate')} type="date" />
            </Field>

            <Field label="Next due odometer" error={form.formState.errors.nextDueOdometer?.message}>
              <Input
                {...form.register('nextDueOdometer', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
                min={0}
                type="number"
              />
            </Field>
          </div>

          <Field label="Notes" error={form.formState.errors.notes?.message}>
            <Textarea
              {...form.register('notes')}
              placeholder="Service details, parts replaced, or follow-up actions"
            />
          </Field>

          {submitError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}

          {submissionState ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {submissionState}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button disabled={form.formState.isSubmitting || isSubmitting} type="submit">
              Save Record
            </Button>
            <p className="text-sm text-slate-500">
              {isSubmitting
                ? 'Submitting maintenance record to the API...'
                : 'The record is stored immediately after submit.'}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type FieldProps = {
  children: ReactNode;
  error?: string;
  label: string;
};

function Field({ children, error, label }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}
