import { useQuery } from '@tanstack/react-query';
import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  type CreateMaintenanceLineItemInput,
  type CreateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, type DefaultValues, type Path, useForm, useWatch } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { vehicleIntervalsQueryOptions } from '@/features/vehicles/api/get-vehicle-intervals';
import { format } from '@/lib/format';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';

import { maintenanceRecordsQueryOptions } from '../api/get-maintenance-records';
import {
  maintenanceFormSchema,
  type MaintenanceFormValues,
} from '../schemas/maintenance-form.schema';
import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';
import { findPreviousConfirmedService } from '../utils/find-previous-confirmed-service';
import {
  getMaintenanceLineItemBreakdown,
  isMeaningfulMaintenanceLineItem,
  resolveMaintenanceLineItemTotalOrUndefined,
  roundMoney,
} from '../utils/get-maintenance-line-item-breakdown';
import type { BillField } from '../utils/get-fields-from-bill';
import {
  nextDueFromSchedule,
  scheduledNextDue,
  type NextDue,
} from '../utils/next-due-from-schedule';
import type { CategoryPick } from '../utils/pick-due-category';
import { workName } from '../utils/service-work';
import { AmountInput } from './amount-input';
import { CategoryChips } from './category-chips';
import { MaintenanceLineItemsEditor } from './maintenance-line-items-editor';
import { NextDueSummary, type NextDueState } from './next-due-summary';
import { WorkshopSuggestions } from './workshop-suggestions';

/**
 * A new record starts on today with the numbers empty, never 0: a service saved
 * at 0 km resets "last done at", the next-due reminder and the forecast. The
 * vehicle's current reading fills the odometer once it has loaded.
 */
function emptyMaintenanceValues(): DefaultValues<MaintenanceFormValues> {
  return {
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

type Extra = 'workshop' | 'items' | 'notes';

/** Which collapsed extra holds a field, so a complaint about it is never hidden. */
function extraFor(field: string): Extra | null {
  if (field === 'workshopName' || field === 'invoiceNumber') return 'workshop';
  if (field === 'lineItems') return 'items';
  if (field === 'notes') return 'notes';
  return null;
}

/** The work that changes the engine oil, where the recorded grade is worth a glance. */
const OIL_WORK = new Set<string>([
  MaintenanceCategory.EngineOil,
  MaintenanceCategory.PeriodicService,
]);

type MaintenanceFormProps = {
  vehicleId?: string;
  /** The record being edited, so it is not compared with itself. */
  recordId?: string;
  /** The vehicle's odometer on file: a new record's default and the field's hint. */
  currentOdometer?: number;
  /** The engine oil the owner recorded ("5W-30 · 3.8 L"), shown beside oil work. */
  engineOil?: string | null;
  /** Fields a draft took from its bill; each is marked "from bill" until edited. */
  fieldsFromBill?: ReadonlySet<BillField>;
  isSubmitting?: boolean;
  onSubmit: (values: CreateMaintenanceRecordBody) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<MaintenanceFormValues>;
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * The category a new record starts on and why (a due service, or the
   * reminder it was opened from). Ignored once the owner picks one, and for a
   * record that already has one.
   */
  suggestedCategory?: CategoryPick | null;
  /**
   * Work the next due out from the vehicle's schedule when the record has
   * none of its own: for a new record and a draft, not an edit of a service
   * logged long ago.
   */
  scheduleNextDue?: boolean;
  /**
   * Logged from a reminder that repeats: its own rule, not the schedule, sets
   * the next one. The form shows it and sends no next due of its own, so the
   * API schedules the reminder's next occurrence (same title, same rule),
   * unless the owner changes it.
   */
  reminderRepeat?: { months: number | null; km: number | null } | null;
  /** Content above the form: the bill buttons on a new record. */
  leading?: ReactNode;
  /** Beside the save button from `md` up: a way back without saving. */
  cancel?: ReactNode;
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
  nextDue: NextDue | null,
): CreateMaintenanceRecordInput {
  const lineItems = toCreateMaintenanceLineItems(values);
  const derivedBreakdown = getMaintenanceLineItemBreakdown(lineItems);
  const hasStructuredLineItems = lineItems.length > 0;

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
    nextDueDate: toIsoDateString(nextDue?.date),
    nextDueOdometer: nextDue?.odometer,
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

/**
 * The log-service form, one short screen on a phone (the approved "Log
 * service" board): what was done as one-tap chips, the date and reading
 * defaulted and explained, the total on the bill, the extras collapsed, the
 * next due worked out before saving, and Save pinned above the bottom bar.
 * A new record, a draft being confirmed and an edit all use it.
 */
export function MaintenanceForm({
  vehicleId,
  recordId,
  currentOdometer,
  engineOil,
  fieldsFromBill,
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  onDirtyChange,
  suggestedCategory,
  scheduleNextDue = false,
  reminderRepeat = null,
  leading,
  cancel,
  submitLabel = 'Save service',
  submittingLabel = 'Saving service…',
  submitHint,
  successMessage = 'Service record saved.',
}: MaintenanceFormProps) {
  const idPrefix = useId();
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const [lowOdometerWarning, setLowOdometerWarning] = useState<{
    odometer: number;
    previousOdometer: number;
  } | null>(null);
  // The reading the owner has already said to save although it is lower.
  const confirmedLowOdometer = useRef<number | null>(null);
  const [openExtras, setOpenExtras] = useState<string[]>([]);
  // Null until the owner chooses: then 'own' (typed) or 'schedule'.
  const [nextDueChoice, setNextDueChoice] = useState<'reminder' | 'schedule' | 'own' | null>(null);
  const [isEditingNextDue, setIsEditingNextDue] = useState(false);

  const recordsQuery = useQuery({
    ...maintenanceRecordsQueryOptions(vehicleId ?? ''),
    enabled: Boolean(vehicleId),
  });
  const intervalsQuery = useQuery(vehicleIntervalsQueryOptions(vehicleId ?? ''));

  const form = useForm<MaintenanceFormValues>({
    defaultValues: emptyMaintenanceValues(),
  });

  const [
    lineItems,
    currencyCode,
    category,
    serviceDate,
    enteredOdometer,
    workshopName,
    notes,
    nextDueDate,
    nextDueOdometer,
  ] = useWatch({
    control: form.control,
    name: [
      'lineItems',
      'currencyCode',
      'category',
      'serviceDate',
      'odometer',
      'workshopName',
      'notes',
      'nextDueDate',
      'nextDueOdometer',
    ],
  });
  const lineItemBreakdown = useMemo(
    () => getMaintenanceLineItemBreakdown(lineItems ?? []),
    [lineItems],
  );
  const structuredLineItemCount = useMemo(
    () => (lineItems ?? []).filter((lineItem) => isMeaningfulMaintenanceLineItem(lineItem)).length,
    [lineItems],
  );
  const hasStructuredLineItems = structuredLineItemCount > 0;

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

  const suggested = initialValues?.category ? null : (suggestedCategory ?? null);

  useEffect(() => {
    if (!suggested || form.getFieldState('category').isDirty) {
      return;
    }

    // Like the reading above: a default, not an edit.
    form.setValue('category', suggested.category, { shouldDirty: false });
  }, [form, suggested]);

  const { dirtyFields, errors } = form.formState;
  const isFromBill = (field: BillField) =>
    Boolean(fieldsFromBill?.has(field) && !dirtyFields[field]);
  const fromBill = (field: BillField) => (isFromBill(field) ? <FromBillMarker /> : undefined);

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

  // The next due: the reminder's repeat or else the schedule's, unless the
  // record brings its own (a bill, an earlier save) or the owner changes it.
  const hasOwnNextDue =
    Boolean(initialValues?.nextDueDate) || initialValues?.nextDueOdometer !== undefined;
  const nextDueSource =
    nextDueChoice ??
    (hasOwnNextDue ? 'own' : reminderRepeat ? 'reminder' : scheduleNextDue ? 'schedule' : 'own');
  const reminderDue = useMemo(
    () =>
      reminderRepeat
        ? nextDueFromSchedule(reminderRepeat, {
            serviceDate,
            odometer: enteredOdometer,
          })
        : null,
    [enteredOdometer, reminderRepeat, serviceDate],
  );
  const scheduled = useMemo(
    () =>
      scheduledNextDue({
        interval: intervalsQuery.data?.[category],
        category,
        serviceDate,
        odometer: enteredOdometer,
        records: recordsQuery.data ?? [],
        excludeRecordId: recordId,
        currentOdometer,
        today: todayDateInputValue(),
      }),
    [
      category,
      currentOdometer,
      enteredOdometer,
      intervalsQuery.data,
      recordId,
      recordsQuery.data,
      serviceDate,
    ],
  );
  const ownNextDue: NextDue | null =
    nextDueDate || typeof nextDueOdometer === 'number'
      ? {
          date: nextDueDate || undefined,
          odometer: typeof nextDueOdometer === 'number' ? nextDueOdometer : undefined,
        }
      : null;
  const scheduledDue = scheduled.kind === 'due' ? scheduled.due : null;
  let nextDueState: NextDueState;
  if (nextDueSource === 'own') {
    nextDueState = ownNextDue
      ? {
          kind: 'due',
          due: ownNextDue,
          fromBill: isFromBill('nextDueDate') || isFromBill('nextDueOdometer'),
        }
      : { kind: 'unset' };
  } else if (nextDueSource === 'reminder') {
    nextDueState = reminderDue ? { kind: 'due', due: reminderDue } : { kind: 'unset' };
  } else if (intervalsQuery.isPending && Boolean(vehicleId)) {
    nextDueState = { kind: 'loading' };
  } else {
    nextDueState = scheduled;
  }
  const showNextDueFields =
    isEditingNextDue || Boolean(errors.nextDueDate) || Boolean(errors.nextDueOdometer);

  function openExtrasFor(fields: string[]) {
    const extras = fields.map(extraFor).filter((extra): extra is Extra => extra !== null);

    if (extras.length) {
      setOpenExtras((current) => Array.from(new Set([...current, ...extras])));
    }
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const localResult = maintenanceFormSchema.safeParse(values);

    if (!localResult.success) {
      setFormIssueErrors(form, localResult.error.issues);
      openExtrasFor(localResult.error.issues.map((issue) => String(issue.path[0] ?? '')));
      setSubmissionState(null);
      return;
    }

    // The reminder's own: left to the API, which counts it from this record.
    const nextDue: NextDue | null =
      nextDueSource === 'reminder'
        ? null
        : nextDueSource === 'schedule'
          ? scheduledDue
          : {
              date: localResult.data.nextDueDate || undefined,
              odometer: localResult.data.nextDueOdometer,
            };
    const contractResult = MaintenanceRecordCreateSchema.omit({ vehicleId: true }).safeParse(
      toCreateMaintenanceRecordInput(localResult.data, nextDue),
    );

    if (!contractResult.success) {
      setFormIssueErrors(form, contractResult.error.issues);
      openExtrasFor(contractResult.error.issues.map((issue) => String(issue.path[0] ?? '')));
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
    } catch {
      // The page says what went wrong (`submitError` and its toast).
      setSubmissionState(null);
    }
  });

  // "Today, and the last reading you saved": said while both are still the defaults.
  // Compared by value: the reading is set without marking it dirty, and RHF
  // counts it dirty against its empty default as soon as anything else changes.
  const isDefaultDateAndReading =
    !initialValues?.serviceDate &&
    currentOdometer !== undefined &&
    enteredOdometer === currentOdometer &&
    serviceDate === todayDateInputValue();
  const dateAndReadingHint = isDefaultDateAndReading
    ? 'Today, and the last reading you saved. Change them if the visit was earlier.'
    : currentOdometer !== undefined
      ? `Last saved reading: ${format.odometer(currentOdometer)}.`
      : undefined;
  const categoryLabelId = `${idPrefix}-category-label`;
  const categoryReasonId = `${idPrefix}-category-reason`;
  const categoryReason =
    suggested && category === suggested.category ? suggested.reason : undefined;
  const work = workName(category);

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {leading}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label id={categoryLabelId}>What was done</Label>
          {fromBill('category')}
        </div>
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <CategoryChips
              describedBy={categoryReason ? categoryReasonId : undefined}
              labelledBy={categoryLabelId}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
        {categoryReason ? (
          <p className="text-small text-fg-3" id={categoryReasonId}>
            {categoryReason}
          </p>
        ) : null}
        {engineOil && OIL_WORK.has(category) ? (
          <p className="text-small text-fg-2" data-testid="engine-oil-hint">
            This engine takes {engineOil}.
          </p>
        ) : null}
        {errors.category?.message ? (
          <p className="text-small text-late" role="alert">
            {errors.category.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            error={errors.serviceDate?.message}
            htmlFor="maintenance-service-date"
            labelAddon={fromBill('serviceDate')}
            label="Date"
          >
            <Input
              aria-invalid={Boolean(errors.serviceDate)}
              id="maintenance-service-date"
              type="date"
              {...form.register('serviceDate')}
            />
          </FormField>

          <FormField
            error={errors.odometer?.message}
            htmlFor="maintenance-odometer"
            labelAddon={fromBill('odometer')}
            label="Odometer"
          >
            <Input
              aria-invalid={Boolean(errors.odometer)}
              className="font-medium"
              id="maintenance-odometer"
              inputMode="numeric"
              min={0}
              type="number"
              {...form.register('odometer', { valueAsNumber: true })}
            />
          </FormField>
        </div>
        {dateAndReadingHint ? <p className="text-small text-fg-3">{dateAndReadingHint}</p> : null}
      </div>

      <FormField
        description={
          hasStructuredLineItems
            ? `Worked out from ${structuredLineItemCount} item${structuredLineItemCount === 1 ? '' : 's'} in parts and labour.`
            : undefined
        }
        error={errors.totalCost?.message}
        htmlFor="maintenance-total-cost"
        labelAddon={fromBill('totalCost')}
        label="Total on the bill"
      >
        <Controller
          control={form.control}
          name="totalCost"
          render={({ field }) => (
            <AmountInput
              aria-invalid={Boolean(errors.totalCost)}
              currencyCode={currencyCode}
              id="maintenance-total-cost"
              name={field.name}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              placeholder="Amount"
              readOnly={hasStructuredLineItems}
              ref={field.ref}
              value={field.value}
            />
          )}
        />
      </FormField>

      <div className="border-t border-line-subtle">
        <Accordion onValueChange={setOpenExtras} type="multiple" value={openExtras}>
          <AccordionItem value="workshop">
            <AccordionTrigger>
              <ExtraHeading
                label="Workshop"
                marker={fromBill('workshopName')}
                summary={workshopName?.trim() || 'Add'}
              />
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-3">
              <FormField
                error={errors.workshopName?.message}
                htmlFor="maintenance-workshop-name"
                labelAddon={fromBill('workshopName')}
                label="Workshop or garage"
              >
                <Input
                  aria-invalid={Boolean(errors.workshopName)}
                  autoComplete="off"
                  id="maintenance-workshop-name"
                  placeholder="Where it was done, or leave empty if you did it yourself"
                  {...form.register('workshopName')}
                />
              </FormField>
              <WorkshopSuggestions
                onPick={(name) =>
                  form.setValue('workshopName', name, { shouldDirty: true, shouldValidate: true })
                }
                typed={workshopName ?? ''}
              />
              <FormField
                error={errors.invoiceNumber?.message}
                htmlFor="maintenance-invoice-number"
                labelAddon={fromBill('invoiceNumber')}
                label="Invoice or job card number"
              >
                <Input
                  aria-invalid={Boolean(errors.invoiceNumber)}
                  id="maintenance-invoice-number"
                  placeholder="Optional"
                  {...form.register('invoiceNumber')}
                />
              </FormField>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="items">
            <AccordionTrigger>
              <ExtraHeading
                label="Parts and labour"
                summary={
                  hasStructuredLineItems
                    ? `${structuredLineItemCount} item${structuredLineItemCount === 1 ? '' : 's'} · ${format.money(lineItemBreakdown.totalCost, { currency: currencyCode })}`
                    : 'Add items'
                }
              />
            </AccordionTrigger>
            <AccordionContent>
              <MaintenanceLineItemsEditor
                control={form.control}
                currencyCode={currencyCode}
                errors={errors}
                register={form.register}
                setValue={form.setValue}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes">
            <AccordionTrigger>
              <ExtraHeading
                label="Notes"
                marker={fromBill('notes')}
                summary={notes?.trim() || 'Add'}
              />
            </AccordionTrigger>
            <AccordionContent>
              <FormField error={errors.notes?.message} htmlFor="maintenance-notes" label="Notes">
                <Textarea
                  aria-invalid={Boolean(errors.notes)}
                  id="maintenance-notes"
                  placeholder="What was done, symptoms, anything the bill does not say"
                  {...form.register('notes')}
                />
              </FormField>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="border-t border-line-subtle">
          <NextDueSummary
            action={
              showNextDueFields ? (
                reminderDue ? (
                  <Button
                    onClick={() => {
                      setNextDueChoice('reminder');
                      setIsEditingNextDue(false);
                      form.clearErrors(['nextDueDate', 'nextDueOdometer']);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Use the reminder&apos;s repeat
                  </Button>
                ) : scheduleNextDue && scheduled.kind === 'due' ? (
                  <Button
                    onClick={() => {
                      setNextDueChoice('schedule');
                      setIsEditingNextDue(false);
                      form.clearErrors(['nextDueDate', 'nextDueOdometer']);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Use the schedule
                  </Button>
                ) : null
              ) : (
                <Button
                  onClick={() => {
                    const shown =
                      nextDueSource === 'reminder'
                        ? reminderDue
                        : nextDueSource === 'schedule' && scheduled.kind === 'due'
                          ? scheduled.due
                          : null;
                    if (shown) {
                      form.setValue('nextDueDate', shown.date ?? '', { shouldDirty: true });
                      form.setValue('nextDueOdometer', shown.odometer, { shouldDirty: true });
                    }
                    setNextDueChoice('own');
                    setIsEditingNextDue(true);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {nextDueState.kind === 'due' ? 'Change' : 'Add'}
                </Button>
              )
            }
            state={nextDueState}
            work={work}
          >
            {showNextDueFields ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  error={errors.nextDueDate?.message}
                  htmlFor="maintenance-next-due-date"
                  labelAddon={fromBill('nextDueDate')}
                  label="Next due date"
                >
                  <Input
                    aria-invalid={Boolean(errors.nextDueDate)}
                    id="maintenance-next-due-date"
                    type="date"
                    {...form.register('nextDueDate')}
                  />
                </FormField>

                <FormField
                  error={errors.nextDueOdometer?.message}
                  htmlFor="maintenance-next-due-odometer"
                  labelAddon={fromBill('nextDueOdometer')}
                  label="Next due odometer"
                >
                  <Input
                    aria-invalid={Boolean(errors.nextDueOdometer)}
                    id="maintenance-next-due-odometer"
                    inputMode="numeric"
                    min={0}
                    type="number"
                    {...form.register('nextDueOdometer', {
                      setValueAs: (value) =>
                        value === '' || value === undefined || value === null
                          ? undefined
                          : Number(value),
                    })}
                  />
                </FormField>
              </div>
            ) : null}
          </NextDueSummary>
        </div>
      </div>

      {submitError ? <InlineError message={submitError} /> : null}

      {lowOdometerWarning && lowOdometerWarning.odometer === enteredOdometer ? (
        <div
          className="rounded-control border border-soon/30 bg-soon-tint px-3.5 py-2.5 text-ui leading-5 text-soon"
          role="alert"
        >
          <p>
            Lower than your last service at {format.odometer(lowOdometerWarning.previousOdometer)} —
            save anyway?
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
        <p className="rounded-control border border-ok/30 bg-ok-tint px-3.5 py-2.5 text-ui leading-5 text-ok">
          {submissionState}
        </p>
      ) : null}

      {/* Pinned above the phone's bottom bar (64px and its border, plus the
          home-indicator inset) so Save is always one tap away; in the flow from md. */}
      <div
        className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-2 border-t border-line-subtle bg-surface px-4 py-3 md:static md:mx-0 md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0"
        data-testid="maintenance-form-actions"
      >
        <Button
          className="w-full md:w-auto"
          disabled={form.formState.isSubmitting || isSubmitting}
          size="lg"
          type="submit"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        {cancel ? <div className="hidden md:block">{cancel}</div> : null}
        {submitHint ? (
          <p className="text-small leading-5 text-fg-3 md:max-w-md">{submitHint}</p>
        ) : null}
      </div>
    </form>
  );
}

function ExtraHeading({
  label,
  summary,
  marker,
}: {
  label: string;
  summary: string;
  marker?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2">
        {label}
        {marker}
      </span>
      <span className="min-w-0 truncate text-ui font-normal text-fg-3">{summary}</span>
    </span>
  );
}

function FromBillMarker() {
  return (
    <span className="rounded-full bg-brand-tint px-1.5 py-0.5 text-caption font-semibold text-brand ring-1 ring-inset ring-brand/30">
      from bill
    </span>
  );
}
