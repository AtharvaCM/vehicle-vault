import { PasswordResetRequestSchema, type PasswordResetRequestInput } from '@vehicle-vault/shared';
import { type Path, useForm } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PasswordResetRequestFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: PasswordResetRequestInput) => Promise<void> | void;
  submitError?: string | null;
};

export function PasswordResetRequestForm({
  isSubmitting = false,
  onSubmit,
  submitError,
}: PasswordResetRequestFormProps) {
  const form = useForm<PasswordResetRequestInput>({
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = PasswordResetRequestSchema.safeParse({
      email: values.email.trim(),
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<PasswordResetRequestInput>, {
            message: issue.message,
          });
        }
      });

      return;
    }

    await onSubmit(result.data);
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField
        htmlFor="password-reset-email"
        label="Email address"
        error={form.formState.errors.email?.message}
      >
        <Input
          autoComplete="email"
          id="password-reset-email"
          placeholder="you@example.com"
          type="email"
          {...form.register('email')}
          aria-invalid={Boolean(form.formState.errors.email)}
        />
      </FormField>

      {submitError ? <InlineError message={submitError} /> : null}

      <Button className="w-full" disabled={form.formState.isSubmitting || isSubmitting} type="submit">
        {isSubmitting ? 'Sending reset email...' : 'Send password reset email'}
      </Button>
    </form>
  );
}
