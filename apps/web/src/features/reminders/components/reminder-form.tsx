import { ReminderCreateSchema, ReminderType } from '@vehicle-vault/shared';
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

import { reminderFormSchema, type ReminderFormValues } from '../schemas/reminder-form.schema';
import type { CreateReminderBody } from '../types/reminder';
import { formatReminderType } from '../utils/format-reminder-type';

const reminderTypeOptions = Object.values(ReminderType);

type ReminderFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: CreateReminderBody) => Promise<void> | void;
  submitError?: string | null;
  initialValues?: Partial<ReminderFormValues>;
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

function toReminderPayload(values: ReminderFormValues): CreateReminderBody {
  return {
    title: values.title.trim(),
    type: values.type,
    dueDate: toIsoDateString(values.dueDate),
    dueOdometer: values.dueOdometer,
    notes: values.notes?.trim() ? values.notes.trim() : undefined,
  };
}

const defaultReminderValues: ReminderFormValues = {
  title: '',
  type: ReminderType.Service,
  dueDate: '',
  dueOdometer: undefined,
  notes: '',
};

export function ReminderForm({
  isSubmitting = false,
  onSubmit,
  submitError,
  initialValues,
  onDirtyChange,
  submitLabel = 'Save Reminder',
  submittingLabel = 'Saving reminder...',
  submitHint = 'Use a due date, a due odometer, or both to track this reminder.',
  successMessage = 'Reminder saved.',
}: ReminderFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const form = useForm<ReminderFormValues>({
    defaultValues: defaultReminderValues,
  });

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
        <CardDescription>Give the reminder a clear title and at least one due trigger.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-3.5 md:grid-cols-2">
            <FormField htmlFor="reminder-title" label="Title" error={form.formState.errors.title?.message}>
              <Input
                id="reminder-title"
                {...form.register('title')}
                aria-invalid={Boolean(form.formState.errors.title)}
                placeholder="Insurance renewal"
              />
            </FormField>

            <FormField htmlFor="reminder-type" label="Type" error={form.formState.errors.type?.message}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="reminder-type" aria-invalid={Boolean(form.formState.errors.type)}>
                      <SelectValue placeholder="Select a reminder type" />
                    </SelectTrigger>
                    <SelectContent>
                      {reminderTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatReminderType(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField htmlFor="reminder-due-date" label="Due date" error={form.formState.errors.dueDate?.message}>
              <Input
                id="reminder-due-date"
                {...form.register('dueDate')}
                aria-invalid={Boolean(form.formState.errors.dueDate)}
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

          <FormField htmlFor="reminder-notes" label="Notes" error={form.formState.errors.notes?.message}>
            <Textarea
              id="reminder-notes"
              {...form.register('notes')}
              aria-invalid={Boolean(form.formState.errors.notes)}
              placeholder="Add context, documents to carry, or what to check"
            />
          </FormField>

          {submitError ? <InlineError message={submitError} /> : null}

          {submissionState ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm leading-5 text-emerald-700">
              {submissionState}
            </p>
          ) : null}

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button disabled={form.formState.isSubmitting || isSubmitting} size="sm" type="submit">
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
            <p className="text-sm leading-5 text-slate-500 sm:max-w-md">
              {isSubmitting ? 'Saving reminder...' : submitHint}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
