import { PasswordResetConfirmSchema, type PasswordResetConfirmInput } from '@vehicle-vault/shared';
import { useForm, type Path } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/shared/password-input';

type PasswordResetFormValues = {
  password: string;
  confirmPassword: string;
};

type PasswordResetFormProps = {
  /** From the emailed link's address; never shown or typed. */
  token: string;
  isSubmitting?: boolean;
  onSubmit: (values: PasswordResetConfirmInput) => Promise<void> | void;
  submitError?: string | null;
};

export function PasswordResetForm({
  token,
  isSubmitting = false,
  onSubmit,
  submitError,
}: PasswordResetFormProps) {
  const form = useForm<PasswordResetFormValues>({
    defaultValues: {
      confirmPassword: '',
      password: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = PasswordResetConfirmSchema.safeParse({
      password: values.password,
      token,
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (field === 'password') {
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
        htmlFor="password-reset-new-password"
        label="New password"
        error={form.formState.errors.password?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          id="password-reset-new-password"
          placeholder="Use at least 8 characters"
          {...form.register('password')}
          aria-invalid={Boolean(form.formState.errors.password)}
        />
      </FormField>

      <FormField
        htmlFor="password-reset-confirm-password"
        label="Confirm new password"
        error={form.formState.errors.confirmPassword?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          id="password-reset-confirm-password"
          placeholder="Re-enter the new password"
          {...form.register('confirmPassword')}
          aria-invalid={Boolean(form.formState.errors.confirmPassword)}
        />
      </FormField>

      {submitError ? <InlineError message={submitError} /> : null}

      <Button
        className="w-full"
        disabled={form.formState.isSubmitting || isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Resetting password...' : 'Reset password'}
      </Button>
    </form>
  );
}
