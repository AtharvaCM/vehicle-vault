import { useEffect } from 'react';
import { type DefaultValues, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateFuelLogInput } from '@vehicle-vault/shared';
import { FuelType } from '@vehicle-vault/shared';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { format } from '@/lib/format';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';

import { fuelLogFormSchema, type FuelLogFormValues } from '../schemas/fuel-log-form.schema';
import { fuelNoun, fuelQuantityUnit, supportsFullTank } from '../utils/fuel-unit';

/**
 * Numbers start empty rather than 0: a pre-filled 0 has to be cleared before
 * typing, and one left in place would save a fill at 0 km. Full tank starts
 * on for anything with a tank to fill; an EV, charged rather than filled, has
 * no such toggle at all.
 */
function emptyFuelLogValues(fuelType: FuelType): DefaultValues<FuelLogFormValues> {
  return {
    totalCost: undefined,
    quantity: undefined,
    odometer: undefined,
    isFullTank: supportsFullTank(fuelType) ? true : undefined,
    date: todayDateInputValue(),
    price: undefined,
    location: '',
    paymentMethod: '',
    notes: '',
  };
}

type FuelLogFormProps = {
  /** Which unit, noun and toggles the form shows; see `../utils/fuel-unit`. */
  fuelType: FuelType;
  isSubmitting?: boolean;
  onSubmit: (values: CreateFuelLogInput) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<FuelLogFormValues>;
  submitLabel?: string;
  /** The vehicle's own reading, shown as a hint under Odometer rather than filled in. */
  lastOdometer?: number;
};

/**
 * The three fields a fill actually needs — amount paid, quantity, odometer —
 * with everything else (date, station, the computed price per unit, payment,
 * notes) collapsed under "More details". See issue #294: a fill logged in
 * about ten seconds.
 */
export function FuelLogForm({
  fuelType,
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  submitLabel,
  lastOdometer,
}: FuelLogFormProps) {
  const unit = fuelQuantityUnit(fuelType);
  const noun = fuelNoun(fuelType);
  const showFullTank = supportsFullTank(fuelType);

  const form = useForm<FuelLogFormValues>({
    resolver: zodResolver(fuelLogFormSchema),
    defaultValues: { ...emptyFuelLogValues(fuelType), ...initialValues },
  });

  // Reset form when initialValues change (e.g. from OCR, or a different log to edit).
  useEffect(() => {
    if (initialValues) {
      form.reset({ ...emptyFuelLogValues(fuelType), ...initialValues });
    }
    // fuelType does not change under an open form; only the values being edited should reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const totalCost = form.watch('totalCost');
  const quantity = form.watch('quantity');
  const isFullTank = form.watch('isFullTank');

  // Price per unit follows amount ÷ quantity; still editable under More details.
  useEffect(() => {
    if (totalCost > 0 && quantity > 0) {
      const calculated = parseFloat((totalCost / quantity).toFixed(2));
      form.setValue('price', calculated, { shouldValidate: true });
    }
  }, [totalCost, quantity, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        ...values,
        isFullTank: showFullTank ? values.isFullTank : undefined,
        date: new Date(values.date).toISOString(),
      });
    } catch {
      // Error handled by parent via submitError
    }
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField
        error={form.formState.errors.totalCost?.message}
        htmlFor="fuel-total-cost"
        label="Amount paid"
      >
        <Input
          id="fuel-total-cost"
          inputMode="decimal"
          min={0}
          step="0.01"
          type="number"
          {...form.register('totalCost', { valueAsNumber: true })}
        />
      </FormField>

      <FormField
        error={form.formState.errors.quantity?.message}
        htmlFor="fuel-quantity"
        label={`Quantity (${unit})`}
      >
        <Input
          id="fuel-quantity"
          inputMode="decimal"
          min={0}
          step="0.01"
          type="number"
          {...form.register('quantity', { valueAsNumber: true })}
        />
      </FormField>

      <FormField
        description={
          lastOdometer !== undefined ? `Last reading: ${format.odometer(lastOdometer)}` : undefined
        }
        error={form.formState.errors.odometer?.message}
        htmlFor="fuel-odometer"
        label="Odometer (km)"
      >
        <Input
          id="fuel-odometer"
          inputMode="numeric"
          min={0}
          type="number"
          {...form.register('odometer', { valueAsNumber: true })}
        />
      </FormField>

      {showFullTank ? (
        <div className="flex items-start justify-between gap-3 rounded-card border border-line-subtle bg-page/50 p-3">
          <div className="grid gap-0.5">
            <Label htmlFor="fuel-full-tank">Full tank</Label>
            <p className="text-small text-fg-3">
              Economy is measured between full fills — leave this on unless it was a top-up.
            </p>
          </div>
          <Switch
            checked={isFullTank ?? true}
            id="fuel-full-tank"
            onCheckedChange={(checked) => form.setValue('isFullTank', checked)}
          />
        </div>
      ) : null}

      <Accordion collapsible type="single">
        <AccordionItem className="border-b-0" value="more-details">
          <AccordionTrigger>More details</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <FormField error={form.formState.errors.date?.message} htmlFor="fuel-date" label="Date">
              <Input id="fuel-date" type="date" {...form.register('date')} />
            </FormField>

            <FormField
              error={form.formState.errors.location?.message}
              htmlFor="fuel-location"
              label="Station"
            >
              <Input
                id="fuel-location"
                placeholder="HP / BP petrol pump"
                {...form.register('location')}
              />
            </FormField>

            <FormField
              description={`Computed from the amount and quantity above; edit if it isn't right.`}
              error={form.formState.errors.price?.message}
              htmlFor="fuel-price"
              label={`Price per ${unit}`}
            >
              <Input
                id="fuel-price"
                inputMode="decimal"
                min={0}
                step="0.01"
                type="number"
                {...form.register('price', { valueAsNumber: true })}
              />
            </FormField>

            <FormField
              error={form.formState.errors.paymentMethod?.message}
              htmlFor="fuel-payment"
              label="Payment"
            >
              <Input
                id="fuel-payment"
                placeholder="Cash, card, UPI…"
                {...form.register('paymentMethod')}
              />
            </FormField>

            <FormField
              error={form.formState.errors.notes?.message}
              htmlFor="fuel-notes"
              label="Notes"
            >
              <Textarea
                id="fuel-notes"
                placeholder="Any additional details..."
                {...form.register('notes')}
              />
            </FormField>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {submitError ? <InlineError message={submitError} /> : null}

      <DialogFooter>
        <Button className="w-full sm:w-auto" disabled={isSubmitting} size="lg" type="submit">
          {isSubmitting ? 'Saving…' : (submitLabel ?? `Save ${noun.toLowerCase()}`)}
        </Button>
      </DialogFooter>
    </form>
  );
}
