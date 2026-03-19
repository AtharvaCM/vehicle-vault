import { FuelType } from '@vehicle-vault/shared';
import { type Path, useForm } from 'react-hook-form';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { type VehicleFormValues, vehicleFormSchema } from '../schemas/vehicle-form.schema';

const fuelOptions = Object.values(FuelType);

export function VehicleForm() {
  const [submissionState, setSubmissionState] = useState<string | null>(null);

  const form = useForm<VehicleFormValues>({
    defaultValues: {
      registrationNumber: '',
      make: '',
      model: '',
      variant: '',
      year: new Date().getFullYear(),
      fuelType: FuelType.Petrol,
      odometer: 0,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const result = vehicleFormSchema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<VehicleFormValues>, {
            message: issue.message,
          });
        }
      });

      setSubmissionState(null);
      return;
    }

    setSubmissionState(
      'Vehicle submission is scaffolded. Wire this form to a mutation when the API is ready.',
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle details</CardTitle>
        <CardDescription>
          Keep form state local to the feature. Replace the placeholder submit branch with a
          feature-local mutation later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Registration number"
              error={form.formState.errors.registrationNumber?.message}
            >
              <Input {...form.register('registrationNumber')} placeholder="MH12AB1234" />
            </Field>

            <Field label="Make" error={form.formState.errors.make?.message}>
              <Input {...form.register('make')} placeholder="Hyundai" />
            </Field>

            <Field label="Model" error={form.formState.errors.model?.message}>
              <Input {...form.register('model')} placeholder="Creta" />
            </Field>

            <Field label="Variant" error={form.formState.errors.variant?.message}>
              <Input {...form.register('variant')} placeholder="SX (O)" />
            </Field>

            <Field label="Year" error={form.formState.errors.year?.message}>
              <Input {...form.register('year', { valueAsNumber: true })} min={1900} type="number" />
            </Field>

            <Field label="Fuel type" error={form.formState.errors.fuelType?.message}>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                {...form.register('fuelType')}
              >
                {fuelOptions.map((fuelType) => (
                  <option key={fuelType} value={fuelType}>
                    {fuelType}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Odometer" error={form.formState.errors.odometer?.message}>
              <Input
                {...form.register('odometer', { valueAsNumber: true })}
                min={0}
                type="number"
              />
            </Field>
          </div>

          {submissionState ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {submissionState}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button disabled={form.formState.isSubmitting} type="submit">
              Save Vehicle
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
