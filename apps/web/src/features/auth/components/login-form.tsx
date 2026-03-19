import { LoginSchema, type LoginInput } from '@vehicle-vault/shared';
import { useState } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LoginFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: LoginInput) => Promise<void> | void;
  submitError?: string | null;
};

export function LoginForm({ isSubmitting = false, onSubmit, submitError }: LoginFormProps) {
  const [submissionState, setSubmissionState] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = LoginSchema.safeParse({
      email: values.email.trim(),
      password: values.password,
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<LoginInput>, {
            message: issue.message,
          });
        }
      });

      return;
    }

    setSubmissionState(null);
    await onSubmit(result.data);
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Email address" error={form.formState.errors.email?.message}>
        <Input
          autoComplete="email"
          placeholder="you@example.com"
          {...form.register('email')}
          type="email"
        />
      </Field>

      <Field label="Password" error={form.formState.errors.password?.message}>
        <Input
          autoComplete="current-password"
          placeholder="Enter your password"
          {...form.register('password')}
          type="password"
        />
      </Field>

      {submitError ? <InlineError message={submitError} /> : null}
      {submissionState ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {submissionState}
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={form.formState.isSubmitting || isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
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
