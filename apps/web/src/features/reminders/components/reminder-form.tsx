import {
  RENEWAL_DOCUMENT_KIND_BY_REMINDER_TYPE,
  ReminderCreateSchema,
  ReminderType,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, type Path, useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { format } from '@/lib/format';

import { reminderFormSchema, type ReminderFormValues } from '../schemas/reminder-form.schema';
import type { CreateReminderBody } from '../types/reminder';
import { repeatChoiceOptions, toRepeatRule, type RepeatChoice } from '../utils/repeat-rule';

const reminderTypeOptions = Object.values(ReminderType);

type ReminderFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: CreateReminderBody) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<ReminderFormValues>;
  onDirtyChange?: (isDirty: boolean) => void;
  submitLabel?: string;
  submittingLabel?: string;
  /** Under Save; none by default. */
  submitHint?: string;
  /** A way out beside Save, from md; a phone has the page's back link. */
  cancel?: ReactNode;
  successMessage?: string;
  /**
   * The paper this renewal follows, when editing one that does: its due date
   * is the paper's end date, so the field is read-only while the type still
   * matches the paper's kind.
   */
  followsPaper?: { kind: VehicleDocumentKind; title: string };
};

function toIsoDateString(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toReminderPayload(values: ReminderFormValues): CreateReminderBody {
  return {
    title: values.title.trim(),
    type: values.type,
    dueDate: toIsoDateString(values.dueDate),
    dueOdometer: values.dueOdometer,
    notes: values.notes?.trim() ? values.notes.trim() : undefined,
    ...toRepeatRule(values.repeat, values),
  };
}

/**
 * Quick fills: a title, a type and the cadence that kind of reminder usually
 * follows. Road tax is left to the owner, since it is yearly in some states and
 * paid once for the vehicle's life in others.
 */
const presets: {
  label: string;
  title: string;
  type: ReminderType;
  repeat?: RepeatChoice;
  repeatEveryMonths?: number;
  repeatEveryKm?: number;
}[] = [
  {
    label: 'Insurance',
    title: 'Insurance renewal',
    type: ReminderType.Insurance,
    repeat: 'yearly',
  },
  {
    label: 'PUC',
    title: 'PUC certificate renewal',
    type: ReminderType.Puc,
    repeat: 'six-months',
  },
  {
    label: 'Oil change',
    title: 'Engine oil change',
    type: ReminderType.Service,
    repeat: 'custom',
    repeatEveryMonths: 12,
    repeatEveryKm: 10000,
  },
  {
    label: 'Annual service',
    title: 'Annual service',
    type: ReminderType.Service,
    repeat: 'yearly',
  },
  { label: 'Road tax', title: 'Road tax renewal', type: ReminderType.Tax },
];

function numberOrUndefined(value: unknown) {
  return value === '' || value === null || value === undefined ? undefined : Number(value);
}

const defaultReminderValues: ReminderFormValues = {
  title: '',
  type: ReminderType.Service,
  dueDate: '',
  dueOdometer: undefined,
  notes: '',
  repeat: 'none',
  repeatEveryMonths: undefined,
  repeatEveryKm: undefined,
};

export function ReminderForm({
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  onDirtyChange,
  submitLabel = 'Save reminder',
  submittingLabel = 'Saving reminder...',
  submitHint,
  cancel,
  successMessage = 'Reminder saved.',
  followsPaper,
}: ReminderFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const form = useForm<ReminderFormValues>({
    defaultValues: defaultReminderValues,
  });
  const repeat = form.watch('repeat');
  const type = form.watch('type');
  const renewalKind = RENEWAL_DOCUMENT_KIND_BY_REMINDER_TYPE[type];
  const datedByPaper = followsPaper !== undefined && renewalKind === followsPaper.kind;
  const showsMonths = repeat === 'custom';
  const showsKm = repeat === 'distance' || repeat === 'custom';

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

  useEffect(() => {
    form.reset({
      ...defaultReminderValues,
      ...initialValues,
    });
  }, [form, initialValues]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const localResult = reminderFormSchema.safeParse(values);

    if (!localResult.success) {
      localResult.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<ReminderFormValues>, {
            message: issue.message,
          });
        }
      });

      setSubmissionState(null);
      return;
    }

    const payload = toReminderPayload(localResult.data);
    const contractResult = ReminderCreateSchema.safeParse({
      vehicleId: 'vehicle-id-is-provided-by-route',
      ...payload,
    });

    if (!contractResult.success) {
      contractResult.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<ReminderFormValues>, {
            message: issue.message,
          });
        }
      });

      setSubmissionState(null);
      return;
    }

    try {
      await onSubmit(payload);
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
    <Card size="sm">
      <CardHeader className="pb-3">
        <CardTitle>Reminder details</CardTitle>
        <CardDescription>
          Give the reminder a clear title and at least one due trigger.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <p className="mb-2 text-caption font-medium text-fg-3">Quick fill</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-line bg-page text-caption hover:bg-line-subtle hover:text-fg"
                onClick={() => {
                  form.setValue('title', preset.title, { shouldDirty: true });
                  form.setValue('type', preset.type, { shouldDirty: true });
                  if (preset.repeat) {
                    form.setValue('repeat', preset.repeat, { shouldDirty: true });
                    form.setValue('repeatEveryMonths', preset.repeatEveryMonths, {
                      shouldDirty: true,
                    });
                    form.setValue('repeatEveryKm', preset.repeatEveryKm, { shouldDirty: true });
                  }
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
              htmlFor="reminder-title"
              label="Title"
              error={form.formState.errors.title?.message}
            >
              <Input
                id="reminder-title"
                {...form.register('title')}
                aria-invalid={Boolean(form.formState.errors.title)}
                placeholder="Insurance renewal"
              />
            </FormField>

            <FormField
              htmlFor="reminder-type"
              label="Type"
              error={form.formState.errors.type?.message}
            >
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      id="reminder-type"
                      aria-invalid={Boolean(form.formState.errors.type)}
                    >
                      <SelectValue placeholder="Select a reminder type" />
                    </SelectTrigger>
                    <SelectContent>
                      {reminderTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {format.enumLabel('reminderType', type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              description={
                datedByPaper
                  ? `Follows the ${followsPaper.title.toLowerCase()}: due when it ends. Change the date on the paper.`
                  : !followsPaper && renewalKind
                    ? 'If this vehicle has the paper on file, the reminder follows its end date instead.'
                    : undefined
              }
              htmlFor="reminder-due-date"
              label="Due date"
              error={form.formState.errors.dueDate?.message}
            >
              <Input
                id="reminder-due-date"
                {...form.register('dueDate')}
                aria-invalid={Boolean(form.formState.errors.dueDate)}
                className={datedByPaper ? 'bg-page text-fg-2' : undefined}
                readOnly={datedByPaper}
                type="date"
              />
            </FormField>

            <FormField
              htmlFor="reminder-due-odometer"
              label="Due odometer"
              error={form.formState.errors.dueOdometer?.message}
            >
              <Input
                id="reminder-due-odometer"
                {...form.register('dueOdometer', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
                aria-invalid={Boolean(form.formState.errors.dueOdometer)}
                min={0}
                type="number"
              />
            </FormField>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2">
            <FormField
              htmlFor="reminder-repeat"
              label="Repeats"
              error={form.formState.errors.repeat?.message}
            >
              <Controller
                control={form.control}
                name="repeat"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="reminder-repeat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {repeatChoiceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {showsMonths ? (
              <FormField
                htmlFor="reminder-repeat-months"
                label="Every (months)"
                error={form.formState.errors.repeatEveryMonths?.message}
              >
                <Input
                  id="reminder-repeat-months"
                  {...form.register('repeatEveryMonths', { setValueAs: numberOrUndefined })}
                  aria-invalid={Boolean(form.formState.errors.repeatEveryMonths)}
                  min={1}
                  type="number"
                />
              </FormField>
            ) : null}

            {showsKm ? (
              <FormField
                htmlFor="reminder-repeat-km"
                label="Every (km)"
                error={form.formState.errors.repeatEveryKm?.message}
              >
                <Input
                  id="reminder-repeat-km"
                  {...form.register('repeatEveryKm', { setValueAs: numberOrUndefined })}
                  aria-invalid={Boolean(form.formState.errors.repeatEveryKm)}
                  min={1}
                  type="number"
                />
              </FormField>
            ) : null}
          </div>
          <p className="-mt-2 text-ui leading-5 text-fg-3">
            {repeat === 'none'
              ? 'Marking it done ends it.'
              : repeat === 'custom'
                ? 'Marking it done schedules the next one. With both set, whichever comes first.'
                : 'Marking it done schedules the next one.'}
          </p>

          <FormField
            htmlFor="reminder-notes"
            label="Notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea
              id="reminder-notes"
              {...form.register('notes')}
              aria-invalid={Boolean(form.formState.errors.notes)}
              placeholder="Add context, documents to carry, or what to check"
            />
          </FormField>

          {submitError ? <InlineError message={submitError} /> : null}

          {submissionState ? (
            <p className="rounded-xl border border-ok/30 bg-ok-tint px-3.5 py-2.5 text-ui leading-5 text-ok">
              {submissionState}
            </p>
          ) : null}

          {/* Pinned above the phone's bottom bar (64px and its border, plus the
              home-indicator inset) so Save is always one tap away; in the flow from md. */}
          <div
            className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-2 border-t border-line-subtle bg-surface px-4 py-3 md:static md:mx-0 md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0"
            data-testid="reminder-form-actions"
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
      </CardContent>
    </Card>
  );
}
