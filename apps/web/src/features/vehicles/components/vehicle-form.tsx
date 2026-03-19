import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { useEffect, useState } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { ApiError } from '@/lib/api/api-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { type VehicleFormValues, vehicleFormSchema } from '../schemas/vehicle-form.schema';

const fuelOptions = Object.values(FuelType);
const vehicleTypeOptions = Object.values(VehicleType);

type VehicleFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: VehicleFormValues) => Promise<void> | void;
  submitError?: string | null;
};

export function VehicleForm({ isSubmitting = false, onSubmit, submitError }: VehicleFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);

  const form = useForm<VehicleFormValues>({
    defaultValues: {
      registrationNumber: '',
      make: '',
      model: '',
      variant: '',
      year: new Date().getFullYear(),
      vehicleType: VehicleType.Car,
      fuelType: FuelType.Petrol,
      odometer: 0,
      nickname: '',
    },
  });

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = vehicleFormSchema.safeParse({
      ...values,
      nickname: values.nickname?.trim() ? values.nickname.trim() : undefined,
    });

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

    try {
      await onSubmit(result.data);
      setSubmissionState('Vehicle created successfully.');
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
        <CardTitle>Vehicle details</CardTitle>
        <CardDescription>
          Create a real vehicle record through the API using the shared contract consumed by both
          the backend and frontend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
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

            <Field label="Vehicle type" error={form.formState.errors.vehicleType?.message}>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                {...form.register('vehicleType')}
              >
                {vehicleTypeOptions.map((vehicleType) => (
                  <option key={vehicleType} value={vehicleType}>
                    {vehicleType}
                  </option>
                ))}
              </select>
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

            <Field label="Nickname" error={form.formState.errors.nickname?.message}>
              <Input {...form.register('nickname')} placeholder="Family car" />
            </Field>
          </div>

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
              Save Vehicle
            </Button>
            <p className="text-sm text-slate-500">
              {isSubmitting
                ? 'Submitting vehicle to the API...'
                : 'The vehicle is stored immediately after submit.'}
            </p>
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
