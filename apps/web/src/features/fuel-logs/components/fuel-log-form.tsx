import { useEffect } from 'react';
import { type DefaultValues, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateFuelLogInput } from '@vehicle-vault/shared';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';

import { fuelLogFormSchema, type FuelLogFormValues } from '../schemas/fuel-log-form.schema';

/**
 * Numbers start empty rather than 0: a pre-filled 0 has to be cleared before
 * typing, and one left in place would save a fill at 0 km.
 */
function emptyFuelLogValues(): DefaultValues<FuelLogFormValues> {
  return {
    date: todayDateInputValue(),
    odometer: undefined,
    quantity: undefined,
    price: undefined,
    totalCost: undefined,
    location: '',
    notes: '',
  };
}

type FuelLogFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: CreateFuelLogInput) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<FuelLogFormValues>;
  submitLabel?: string;
};

export function FuelLogForm({
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  submitLabel = 'Save fuel log',
}: FuelLogFormProps) {
  const form = useForm<FuelLogFormValues>({
    resolver: zodResolver(fuelLogFormSchema),
    defaultValues: { ...emptyFuelLogValues(), ...initialValues },
  });

  // Reset form when initialValues change (e.g. from OCR)
  useEffect(() => {
    if (initialValues) {
      form.reset({ ...emptyFuelLogValues(), ...initialValues });
    }
  }, [initialValues, form]);

  const quantity = form.watch('quantity');
  const price = form.watch('price');

  // Auto-calculate total cost
  useEffect(() => {
    if (quantity > 0 && price > 0) {
      const calculated = parseFloat((quantity * price).toFixed(2));
      form.setValue('totalCost', calculated, { shouldValidate: true });
    }
  }, [quantity, price, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        ...values,
        date: new Date(values.date).toISOString(),
      });
    } catch {
      // Error handled by parent via submitError
    }
  });

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pb-6 pt-0">
        <CardTitle>Fuel fill detail</CardTitle>
        <CardDescription>Log your fuel purchase to track costs and efficiency.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="fuel-date" label="Date" error={form.formState.errors.date?.message}>
              <Input id="fuel-date" {...form.register('date')} type="date" />
            </FormField>

            <FormField
              htmlFor="fuel-odometer"
              label="Odometer (km)"
              error={form.formState.errors.odometer?.message}
            >
              <Input
                id="fuel-odometer"
                {...form.register('odometer', { valueAsNumber: true })}
                type="number"
                min={0}
              />
            </FormField>

            <FormField
              htmlFor="fuel-quantity"
              label="Quantity (litres)"
              error={form.formState.errors.quantity?.message}
            >
              <Input
                id="fuel-quantity"
                {...form.register('quantity', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min={0}
              />
            </FormField>

            <FormField
              htmlFor="fuel-price"
              label="Price per litre"
              error={form.formState.errors.price?.message}
            >
              <Input
                id="fuel-price"
                {...form.register('price', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min={0}
              />
            </FormField>

            <FormField
              htmlFor="fuel-total-cost"
              label="Total cost"
              error={form.formState.errors.totalCost?.message}
            >
              <Input
                id="fuel-total-cost"
                {...form.register('totalCost', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min={0}
              />
            </FormField>

            <FormField
              htmlFor="fuel-location"
              label="Location / fuel station"
              error={form.formState.errors.location?.message}
            >
              <Input
                id="fuel-location"
                {...form.register('location')}
                placeholder="HP / BP petrol pump"
              />
            </FormField>
          </div>

          <FormField
            htmlFor="fuel-notes"
            label="Notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea
              id="fuel-notes"
              {...form.register('notes')}
              placeholder="Any additional details..."
            />
          </FormField>

          {submitError ? <InlineError message={submitError} /> : null}

          <div className="flex justify-end pt-4">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
