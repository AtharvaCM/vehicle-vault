import { PasswordResetConfirmSchema, type PasswordResetConfirmInput } from '@vehicle-vault/shared';
import { useForm, type Path } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PasswordResetFormValues = PasswordResetConfirmInput & {
  confirmPassword: string;
};

type PasswordResetFormProps = {
  initialToken?: string;
  isSubmitting?: boolean;
  onSubmit: (values: PasswordResetConfirmInput) => Promise<void> | void;
  submitError?: string | null;
};

export function PasswordResetForm({
  initialToken = '',
  isSubmitting = false,
  onSubmit,
  submitError,
}: PasswordResetFormProps) {
  const form = useForm<PasswordResetFormValues>({
    defaultValues: {
      confirmPassword: '',
      password: '',
      token: initialToken,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = PasswordResetConfirmSchema.safeParse({
      password: values.password,
      token: values.token.trim(),
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<PasswordResetFormValues>, {
            message: issue.message,
          });
        }
      });

      return;
    }

    if (values.password !== values.confirmPassword) {
      form.setError('confirmPassword', {
        message: 'Passwords do not match.',
      });
      return;
    }

    await onSubmit(result.data);
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField
        htmlFor="password-reset-token"
        label="Reset token"
        error={form.formState.errors.token?.message}
      >
        <Input
          autoComplete="one-time-code"
          id="password-reset-token"
          placeholder="Paste the reset token"
          {...form.register('token')}
          aria-invalid={Boolean(form.formState.errors.token)}
        />
      </FormField>

      <FormField
        htmlFor="password-reset-new-password"
        label="New password"
        error={form.formState.errors.password?.message}
      >
        <Input
          autoComplete="new-password"
          id="password-reset-new-password"
          placeholder="Use at least 8 characters"
          type="password"
          {...form.register('password')}
          aria-invalid={Boolean(form.formState.errors.password)}
        />
      </FormField>

      <FormField
        htmlFor="password-reset-confirm-password"
        label="Confirm new password"
        error={form.formState.errors.confirmPassword?.message}
      >
        <Input
          autoComplete="new-password"
          id="password-reset-confirm-password"
          placeholder="Re-enter the new password"
          type="password"
          {...form.register('confirmPassword')}
          aria-invalid={Boolean(form.formState.errors.confirmPassword)}
        />
      </FormField>

      {submitError ? <InlineError message={submitError} /> : null}

      <Button className="w-full" disabled={form.formState.isSubmitting || isSubmitting} type="submit">
        {isSubmitting ? 'Resetting password...' : 'Reset password'}
      </Button>
    </form>
  );
}
