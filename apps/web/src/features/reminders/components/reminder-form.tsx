import { ReminderCreateSchema, ReminderType } from '@vehicle-vault/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { ApiError } from '@/lib/api/api-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { reminderFormSchema, type ReminderFormValues } from '../schemas/reminder-form.schema';
import type { CreateReminderBody } from '../types/reminder';
import { formatReminderType } from '../utils/format-reminder-type';

const reminderTypeOptions = Object.values(ReminderType);

type ReminderFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: CreateReminderBody) => Promise<void> | void;
  submitError?: string | null;
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

export function ReminderForm({ isSubmitting = false, onSubmit, submitError }: ReminderFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const form = useForm<ReminderFormValues>({
    defaultValues: {
      title: '',
      type: ReminderType.Service,
      dueDate: '',
      dueOdometer: undefined,
      notes: '',
    },
  });

  useEffect(() => {
    if (submitError) {
      setSubmissionState(null);
    }
  }, [submitError]);

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
      setSubmissionState('Reminder created successfully.');
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
        <CardTitle>Reminder details</CardTitle>
        <CardDescription>
          Create a reminder tied to a vehicle without coupling this slice to delivery or scheduling.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" error={form.formState.errors.title?.message}>
              <Input {...form.register('title')} placeholder="Insurance renewal" />
            </Field>

            <Field label="Type" error={form.formState.errors.type?.message}>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                {...form.register('type')}
              >
                {reminderTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {formatReminderType(type)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Due date" error={form.formState.errors.dueDate?.message}>
              <Input {...form.register('dueDate')} type="date" />
            </Field>

            <Field label="Due odometer" error={form.formState.errors.dueOdometer?.message}>
              <Input
                {...form.register('dueOdometer', {
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
              placeholder="Add context about why this reminder matters"
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
              Save Reminder
            </Button>
            <p className="text-sm text-slate-500">
              {isSubmitting
                ? 'Submitting reminder to the API...'
                : 'Add either a due date or due odometer to track this reminder.'}
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
