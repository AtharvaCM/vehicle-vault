import { useQuery } from '@tanstack/react-query';
import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  type CreateMaintenanceLineItemInput,
  type CreateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { Sparkles, Clock, Calendar, WalletCards, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, type DefaultValues, type Path, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Figure } from '@/components/shared/figure';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { vehicleForecastQueryOptions } from '@/features/vehicles/api/get-vehicle-forecast';
import { ApiError } from '@/lib/api/api-error';
import { format } from '@/lib/format';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';

import { maintenanceRecordsQueryOptions } from '../api/get-maintenance-records';

import {
  maintenanceFormSchema,
  type MaintenanceFormValues,
} from '../schemas/maintenance-form.schema';
import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';
import {
  getMaintenanceLineItemBreakdown,
  isMeaningfulMaintenanceLineItem,
  resolveMaintenanceLineItemTotalOrUndefined,
  roundMoney,
} from '../utils/get-maintenance-line-item-breakdown';
import { findPreviousConfirmedService } from '../utils/find-previous-confirmed-service';
import type { BillField } from '../utils/get-fields-from-bill';
import { MaintenanceLineItemsEditor } from './maintenance-line-items-editor';

const categoryOptions = Object.values(MaintenanceCategory);

/**
 * A new record starts on today with the numbers empty, never 0: a service saved
 * at 0 km resets "last done at", the next-due reminder and the forecast. The
 * vehicle's current reading fills the odometer once it has loaded.
 */
function emptyMaintenanceValues(): DefaultValues<MaintenanceFormValues> {
  return {
    entryMode: 'quick',
    serviceDate: todayDateInputValue(),
    odometer: undefined,
    category: MaintenanceCategory.PeriodicService,
    workshopName: '',
    invoiceNumber: '',
    currencyCode: 'INR',
    totalCost: undefined,
    notes: '',
    nextDueDate: '',
    nextDueOdometer: undefined,
    lineItems: [],
  };
}

const quickPresets = [
  {
    label: 'Oil change',
    category: MaintenanceCategory.EngineOil,
    note: 'Engine oil and filter replacement',
  },
  {
    label: 'Periodic service',
    category: MaintenanceCategory.PeriodicService,
    note: 'Full vehicle inspection and service',
  },
  {
    label: 'Brake service',
    category: MaintenanceCategory.BrakePads,
    note: 'Brake pad inspection/replacement',
  },
  {
    label: 'Tyre rotation',
    category: MaintenanceCategory.TyreRotation,
    note: 'Wheel rotation and alignment check',
  },
] as const;

type MaintenanceFormProps = {
  vehicleId?: string;
  /** The record being edited, so it is not compared with itself. */
  recordId?: string;
  /** The vehicle's odometer on file: a new record's default and the field's hint. */
  currentOdometer?: number;
  /** Fields a draft took from its bill; each is marked "from bill" until edited. */
  fieldsFromBill?: ReadonlySet<BillField>;
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

function toCreateMaintenanceLineItems(values: MaintenanceFormValues) {
  return values.lineItems
    .filter((lineItem) => isMeaningfulMaintenanceLineItem(lineItem))
    .map<CreateMaintenanceLineItemInput>((lineItem, index) => ({
      kind: lineItem.kind,
      name: lineItem.name?.trim() ?? '',
      normalizedCategory: lineItem.normalizedCategory,
      quantity: lineItem.quantity,
      unit: lineItem.unit?.trim() ? lineItem.unit.trim() : undefined,
      unitPrice:
        typeof lineItem.unitPrice === 'number' ? roundMoney(lineItem.unitPrice) : undefined,
      // Resolved rather than the raw typed value: an item entered as qty x unit
      // price must save that amount even when the total field was never touched
      // directly, or the item renders as if it cost nothing.
      lineTotal: resolveMaintenanceLineItemTotalOrUndefined(lineItem),
      brand: lineItem.brand?.trim() ? lineItem.brand.trim() : undefined,
      partNumber: lineItem.partNumber?.trim() ? lineItem.partNumber.trim() : undefined,
      notes: lineItem.notes?.trim() ? lineItem.notes.trim() : undefined,
      position: index,
    }));
}

function toCreateMaintenanceRecordInput(
  values: MaintenanceFormValues,
): CreateMaintenanceRecordInput {
  const lineItems = toCreateMaintenanceLineItems(values);
  const derivedBreakdown = getMaintenanceLineItemBreakdown(lineItems);
  const hasStructuredLineItems = values.entryMode === 'detailed' && lineItems.length > 0;

  return {
    vehicleId: 'vehicle-id-is-provided-by-route',
    serviceDate: toIsoDateString(values.serviceDate) ?? '',
    odometer: values.odometer,
    category: values.category,
    workshopName: values.workshopName?.trim() ? values.workshopName.trim() : undefined,
    invoiceNumber: values.invoiceNumber?.trim() ? values.invoiceNumber.trim() : undefined,
    currencyCode: values.currencyCode.trim().toUpperCase(),
    totalCost: hasStructuredLineItems ? derivedBreakdown.totalCost : roundMoney(values.totalCost),
    laborCost: hasStructuredLineItems ? derivedBreakdown.laborCost : undefined,
    partsCost: hasStructuredLineItems ? derivedBreakdown.partsCost : undefined,
    fluidsCost: hasStructuredLineItems ? derivedBreakdown.fluidsCost : undefined,
    taxCost: hasStructuredLineItems ? derivedBreakdown.taxCost : undefined,
    discountAmount: hasStructuredLineItems ? derivedBreakdown.discountAmount : undefined,
    notes: values.notes?.trim() ? values.notes.trim() : undefined,
    nextDueDate: toIsoDateString(values.nextDueDate),
    nextDueOdometer: values.nextDueOdometer,
    lineItems: hasStructuredLineItems ? lineItems : undefined,
  };
}

function setFormIssueErrors(
  form: ReturnType<typeof useForm<MaintenanceFormValues>>,
  issues: { message: string; path: PropertyKey[] }[],
) {
  issues.forEach((issue) => {
    if (!issue.path.length) {
      return;
    }

    form.setError(issue.path.map(String).join('.') as Path<MaintenanceFormValues>, {
      message: issue.message,
    });
  });
}

export function MaintenanceForm({
  vehicleId,
  recordId,
  currentOdometer,
  fieldsFromBill,
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  onDirtyChange,
  submitLabel = 'Save record',
  submittingLabel = 'Saving record...',
  submitHint = 'Use this record for one completed service, repair, or inspection.',
  successMessage = 'Service record saved.',
}: MaintenanceFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const [lowOdometerWarning, setLowOdometerWarning] = useState<{
    odometer: number;
    previousOdometer: number;
  } | null>(null);
  // The reading the owner has already said to save although it is lower.
  const confirmedLowOdometer = useRef<number | null>(null);

  const forecastQuery = useQuery(vehicleForecastQueryOptions(vehicleId || ''));
  const recordsQuery = useQuery({
    ...maintenanceRecordsQueryOptions(vehicleId ?? ''),
    enabled: Boolean(vehicleId),
  });

  const form = useForm<MaintenanceFormValues>({
    defaultValues: emptyMaintenanceValues(),
  });

  const entryMode = useWatch({
    control: form.control,
    name: 'entryMode',
  });
  const lineItems = useWatch({
    control: form.control,
    name: 'lineItems',
  });
  const currencyCode = useWatch({
    control: form.control,
    name: 'currencyCode',
  });
  const lineItemBreakdown = useMemo(
    () => getMaintenanceLineItemBreakdown(lineItems ?? []),
    [lineItems],
  );
  const structuredLineItemCount = useMemo(
    () => (lineItems ?? []).filter((lineItem) => isMeaningfulMaintenanceLineItem(lineItem)).length,
    [lineItems],
  );
  const hasStructuredLineItems = entryMode === 'detailed' && structuredLineItemCount > 0;

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

  useEffect(() => {
    form.reset({
      ...emptyMaintenanceValues(),
      ...initialValues,
    });
  }, [form, initialValues]);

  useEffect(() => {
    if (
      currentOdometer === undefined ||
      initialValues?.odometer !== undefined ||
      form.getFieldState('odometer').isDirty
    ) {
      return;
    }

    // Not marked dirty, so an untouched form still leaves without a prompt.
    // (`resetField` would be the natural call, but right after the reset above
    // the fields are not registered yet and it does nothing.)
    form.setValue('odometer', currentOdometer, { shouldDirty: false });
  }, [currentOdometer, form, initialValues?.odometer]);

  const enteredOdometer = useWatch({ control: form.control, name: 'odometer' });
  const { dirtyFields } = form.formState;
  const fromBill = (field: BillField) =>
    fieldsFromBill?.has(field) && !dirtyFields[field] ? <FromBillMarker /> : undefined;

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!hasStructuredLineItems) {
      return;
    }

    if (form.getValues('totalCost') === lineItemBreakdown.totalCost) {
      return;
    }

    form.setValue('totalCost', lineItemBreakdown.totalCost, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, hasStructuredLineItems, lineItemBreakdown.totalCost]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const localResult = maintenanceFormSchema.safeParse(values);

    if (!localResult.success) {
      setFormIssueErrors(form, localResult.error.issues);
      setSubmissionState(null);
      return;
    }

    const contractResult = MaintenanceRecordCreateSchema.omit({ vehicleId: true }).safeParse(
      toCreateMaintenanceRecordInput(localResult.data),
    );

    if (!contractResult.success) {
      setFormIssueErrors(form, contractResult.error.issues);
      setSubmissionState(null);
      return;
    }

    const previousService = findPreviousConfirmedService(recordsQuery.data ?? [], {
      serviceDate: localResult.data.serviceDate,
      excludeRecordId: recordId,
    });

    if (
      previousService &&
      localResult.data.odometer < previousService.odometer &&
      confirmedLowOdometer.current !== localResult.data.odometer
    ) {
      setLowOdometerWarning({
        odometer: localResult.data.odometer,
        previousOdometer: previousService.odometer,
      });
      setSubmissionState(null);
      return;
    }

    setLowOdometerWarning(null);

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
      {suggestions.length > 0 ? (
        <Card className="border-brand/30 bg-brand-tint">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <CardTitle className="text-sm font-semibold text-brand">Smart suggestions</CardTitle>
            </div>
            <CardDescription className="text-xs text-brand">
              Based on your vehicle&apos;s usage trend, you might need these services soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.category}
                  className="flex flex-col rounded-lg border border-brand/30 bg-surface p-3 shadow-xs"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-brand">
                      {format.enumLabel('maintenanceCategory', suggestion.category)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-caption font-bold uppercase ${
                        suggestion.priority === 'high'
                          ? 'bg-late-tint text-late'
                          : suggestion.priority === 'medium'
                            ? 'bg-soon-tint text-soon'
                            : 'bg-brand-tint text-brand'
                      }`}
                    >
                      {suggestion.priority} priority
                    </span>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-fg-2">{suggestion.reason}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      {suggestion.estimatedOdometerDue ? (
                        <div className="flex items-center gap-1 text-caption text-fg-3">
                          <Clock className="h-2.5 w-2.5" />
                          <span>~{suggestion.estimatedOdometerDue} km</span>
                        </div>
                      ) : null}
                      {suggestion.estimatedDateDue ? (
                        <div className="flex items-center gap-1 text-caption text-fg-3">
                          <Calendar className="h-2.5 w-2.5" />
                          <span>~{format.date(suggestion.estimatedDateDue)}</span>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      className="h-7 px-2 text-caption font-semibold text-brand hover:bg-brand-tint hover:text-brand"
                      onClick={() => {
                        form.setValue('category', suggestion.category, { shouldDirty: true });
                        form.setValue('notes', suggestion.reason, { shouldDirty: true });
                        toast.info(
                          `Applied ${format.enumLabel('maintenanceCategory', suggestion.category)} suggestion`,
                        );
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Quick apply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Service record</CardTitle>
          <CardDescription>
            Capture the details of one completed service visit, repair, or inspection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium text-fg-3">Common tasks</p>
            <div className="flex flex-wrap gap-2">
              {quickPresets.map((preset) => (
                <Button
                  key={preset.label}
                  className="h-8 rounded-lg border-line bg-page text-xs hover:bg-line-subtle hover:text-fg"
                  onClick={() => {
                    form.setValue('category', preset.category, { shouldDirty: true });
                    form.setValue('notes', preset.note, { shouldDirty: true });
                    toast.info(`Applied ${preset.label} preset`);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <Tabs
              onValueChange={(value) =>
                form.setValue('entryMode', value as MaintenanceFormValues['entryMode'], {
                  shouldDirty: true,
                })
              }
              value={entryMode}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick">Quick entry</TabsTrigger>
                <TabsTrigger value="detailed">Detailed entry</TabsTrigger>
              </TabsList>

              <TabsContent className="space-y-5" value="quick">
                <div className="rounded-2xl border border-border/70 bg-page/70 px-4 py-3 text-sm text-fg-2">
                  Best for fast logging when you mainly need the date, odometer, category, and
                  total.
                </div>
              </TabsContent>

              <TabsContent className="space-y-5" value="detailed">
                <div className="rounded-2xl border border-border/70 bg-page/70 px-4 py-3 text-sm text-fg-2">
                  Use structured items when the invoice breaks work into jobs, parts, fluids, taxes,
                  or discounts.
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid gap-3.5 md:grid-cols-2">
              <FormField
                error={form.formState.errors.serviceDate?.message}
                htmlFor="maintenance-service-date"
                labelAddon={fromBill('serviceDate')}
                label="Service date"
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.serviceDate)}
                  id="maintenance-service-date"
                  type="date"
                  {...form.register('serviceDate')}
                />
              </FormField>

              <FormField
                description={
                  currentOdometer === undefined
                    ? undefined
                    : `Current: ${format.odometer(currentOdometer)}`
                }
                error={form.formState.errors.odometer?.message}
                htmlFor="maintenance-odometer"
                labelAddon={fromBill('odometer')}
                label="Odometer"
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.odometer)}
                  id="maintenance-odometer"
                  min={0}
                  type="number"
                  {...form.register('odometer', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                error={form.formState.errors.category?.message}
                htmlFor="maintenance-category"
                labelAddon={fromBill('category')}
                label="Category"
              >
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger
                        aria-invalid={Boolean(form.formState.errors.category)}
                        id="maintenance-category"
                      >
                        <SelectValue placeholder="Select a service category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>
                            {format.enumLabel('maintenanceCategory', category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField
                error={form.formState.errors.workshopName?.message}
                htmlFor="maintenance-workshop-name"
                labelAddon={fromBill('workshopName')}
                label="Workshop or garage"
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.workshopName)}
                  id="maintenance-workshop-name"
                  placeholder="Authorized service centre"
                  {...form.register('workshopName')}
                />
              </FormField>

              {entryMode === 'detailed' ? (
                <>
                  <FormField
                    error={form.formState.errors.invoiceNumber?.message}
                    htmlFor="maintenance-invoice-number"
                    labelAddon={fromBill('invoiceNumber')}
                    label="Invoice or job card number"
                  >
                    <Input
                      aria-invalid={Boolean(form.formState.errors.invoiceNumber)}
                      id="maintenance-invoice-number"
                      placeholder="Optional"
                      {...form.register('invoiceNumber')}
                    />
                  </FormField>

                  <FormField
                    error={form.formState.errors.currencyCode?.message}
                    htmlFor="maintenance-currency-code"
                    labelAddon={fromBill('currencyCode')}
                    label="Currency"
                  >
                    <Input
                      aria-invalid={Boolean(form.formState.errors.currencyCode)}
                      id="maintenance-currency-code"
                      maxLength={3}
                      placeholder="INR"
                      {...form.register('currencyCode')}
                    />
                  </FormField>
                </>
              ) : null}

              <FormField
                description={
                  hasStructuredLineItems
                    ? `Derived from ${structuredLineItemCount} structured item${structuredLineItemCount === 1 ? '' : 's'}.`
                    : undefined
                }
                error={form.formState.errors.totalCost?.message}
                htmlFor="maintenance-total-cost"
                labelAddon={fromBill('totalCost')}
                label="Total cost"
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.totalCost)}
                  id="maintenance-total-cost"
                  min={0}
                  readOnly={hasStructuredLineItems}
                  step="0.01"
                  type="number"
                  {...form.register('totalCost', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                error={form.formState.errors.nextDueDate?.message}
                htmlFor="maintenance-next-due-date"
                labelAddon={fromBill('nextDueDate')}
                label="Next due date"
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.nextDueDate)}
                  id="maintenance-next-due-date"
                  type="date"
                  {...form.register('nextDueDate')}
                />
              </FormField>

              <FormField
                error={form.formState.errors.nextDueOdometer?.message}
                htmlFor="maintenance-next-due-odometer"
                labelAddon={fromBill('nextDueOdometer')}
                label="Next due odometer"
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.nextDueOdometer)}
                  id="maintenance-next-due-odometer"
                  min={0}
                  type="number"
                  {...form.register('nextDueOdometer', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
              </FormField>
            </div>

            <FormField
              error={form.formState.errors.notes?.message}
              htmlFor="maintenance-notes"
              labelAddon={fromBill('notes')}
              label="Notes"
            >
              <Textarea
                aria-invalid={Boolean(form.formState.errors.notes)}
                id="maintenance-notes"
                placeholder="Service details, symptoms, follow-up actions, or anything not covered in the invoice"
                {...form.register('notes')}
              />
            </FormField>

            {entryMode === 'detailed' ? (
              <>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="border-border/70 bg-page/60 lg:col-span-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-fg-3" />
                        <CardTitle className="text-sm">Structured summary</CardTitle>
                      </div>
                      <CardDescription>
                        Keep the invoice mappable even when each workshop formats it differently.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <BreakdownMetric
                        label="Grand total"
                        value={format.money(
                          hasStructuredLineItems
                            ? lineItemBreakdown.totalCost
                            : form.getValues('totalCost') || 0,
                          { currency: currencyCode },
                        )}
                      />
                      <BreakdownMetric
                        label="Parts"
                        value={format.money(lineItemBreakdown.partsCost, {
                          currency: currencyCode,
                        })}
                      />
                      <BreakdownMetric
                        label="Fluids"
                        value={format.money(lineItemBreakdown.fluidsCost, {
                          currency: currencyCode,
                        })}
                      />
                      <BreakdownMetric
                        label="Labour"
                        value={format.money(lineItemBreakdown.laborCost, {
                          currency: currencyCode,
                        })}
                      />
                      <BreakdownMetric
                        label="Tax"
                        value={format.money(lineItemBreakdown.taxCost, { currency: currencyCode })}
                      />
                      <BreakdownMetric
                        label="Discount"
                        value={format.money(lineItemBreakdown.discountAmount, {
                          currency: currencyCode,
                        })}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-page/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <WalletCards className="h-4 w-4 text-fg-3" />
                        <CardTitle className="text-sm">How totals work</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm leading-6 text-fg-2">
                      <p>Parts, fluids, labour, fees, jobs, and taxes add to the total.</p>
                      <p>Discount items subtract from the total automatically.</p>
                      <p>If you do not add structured items yet, the manual total still works.</p>
                    </CardContent>
                  </Card>
                </div>

                <MaintenanceLineItemsEditor
                  control={form.control}
                  currencyCode={currencyCode}
                  errors={form.formState.errors}
                  register={form.register}
                  setValue={form.setValue}
                />
              </>
            ) : null}

            {submitError ? <InlineError message={submitError} /> : null}

            {lowOdometerWarning && lowOdometerWarning.odometer === enteredOdometer ? (
              <div
                className="rounded-xl border border-soon/30 bg-soon-tint px-3.5 py-2.5 text-sm leading-5 text-soon"
                role="alert"
              >
                <p>
                  Lower than your last service at{' '}
                  {format.odometer(lowOdometerWarning.previousOdometer)} — save anyway?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      confirmedLowOdometer.current = lowOdometerWarning.odometer;
                      void handleSubmit();
                    }}
                    size="sm"
                    type="button"
                  >
                    Save anyway
                  </Button>
                  <Button
                    onClick={() => {
                      setLowOdometerWarning(null);
                      form.setFocus('odometer');
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Change odometer
                  </Button>
                </div>
              </div>
            ) : null}

            {submissionState ? (
              <p className="rounded-xl border border-ok/30 bg-ok-tint px-3.5 py-2.5 text-sm leading-5 text-ok">
                {submissionState}
              </p>
            ) : null}

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button
                disabled={form.formState.isSubmitting || isSubmitting}
                size="sm"
                type="submit"
              >
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
              <p className="text-sm leading-5 text-fg-3 sm:max-w-md">
                {isSubmitting ? 'Saving service record...' : submitHint}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FromBillMarker() {
  return (
    <span className="rounded-full bg-brand-tint px-1.5 py-0.5 text-caption font-semibold text-brand ring-1 ring-inset ring-brand/30">
      from bill
    </span>
  );
}

function BreakdownMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/80 p-4">
      <Figure label={label} value={value} />
    </div>
  );
}
