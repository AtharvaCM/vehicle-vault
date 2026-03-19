import { MaintenanceCategory } from '@vehicle-vault/shared';
import { useState } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  maintenanceFormSchema,
  type MaintenanceFormValues,
} from '../schemas/maintenance-form.schema';

type MaintenanceFormProps = {
  vehicleId: string;
};

const categoryOptions = Object.values(MaintenanceCategory);

export function MaintenanceForm({ vehicleId }: MaintenanceFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);

  const form = useForm<MaintenanceFormValues>({
    defaultValues: {
      serviceDate: '',
      odometer: 0,
      category: MaintenanceCategory.OilChange,
      workshopName: '',
      totalCost: 0,
      notes: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const result = maintenanceFormSchema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
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

    setSubmissionState(
      `Maintenance submission for ${vehicleId} is scaffolded. Replace this placeholder with a mutation when API endpoints are ready.`,
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance record</CardTitle>
        <CardDescription>
          Keep service-specific inputs inside the maintenance feature so list and create flows
          evolve together.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
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
                    {category}
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

          {submissionState ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {submissionState}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button disabled={form.formState.isSubmitting} type="submit">
              Save Record
            </Button>
            <p className="text-sm text-slate-500">No API call is wired yet.</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type FieldProps = {
  children: React.ReactNode;
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
