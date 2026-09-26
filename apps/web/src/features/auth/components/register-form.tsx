import { RegisterSchema, type RegisterInput } from '@vehicle-vault/shared';
import { useForm, type Path } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/shared/password-input';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

type RegisterFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: RegisterInput) => Promise<void> | void;
  submitError?: string | null;
};

export function RegisterForm({ isSubmitting = false, onSubmit, submitError }: RegisterFormProps) {
  const form = useForm<RegisterInput>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  // The one rule, shown as it is met rather than only after a failed submit.
  const longEnough = (form.watch('password') ?? '').length >= 8;

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = RegisterSchema.safeParse({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as Path<RegisterInput>, {
            message: issue.message,
          });
        }
      });

      return;
    }

    await onSubmit(result.data);
  });

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <FormField
        htmlFor="register-name"
        label="Your name"
        error={form.formState.errors.name?.message}
      >
        <Input
          autoComplete="name"
          id="register-name"
          placeholder="Aarav"
          {...form.register('name')}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
      </FormField>

      <FormField
        htmlFor="register-email"
        label="Email address"
        error={form.formState.errors.email?.message}
      >
        <Input
          autoComplete="email"
          id="register-email"
          placeholder="you@example.com"
          {...form.register('email')}
          aria-invalid={Boolean(form.formState.errors.email)}
          type="email"
        />
      </FormField>

      <FormField
        htmlFor="register-password"
        label="Password"
        error={form.formState.errors.password?.message}
      >
        <PasswordInput
          aria-describedby="register-password-rule"
          autoComplete="new-password"
          id="register-password"
          {...form.register('password')}
          aria-invalid={Boolean(form.formState.errors.password)}
        />
        <p
          className={cn(
            'mt-1.5 flex items-center gap-1.5 text-small',
            longEnough ? 'text-ok' : 'text-fg-3',
          )}
          data-met={longEnough || undefined}
          id="register-password-rule"
        >
          <Check aria-hidden="true" className="size-3.5" />
          At least 8 characters
        </p>
      </FormField>

      {submitError ? <InlineError message={submitError} /> : null}

      <Button
        className="w-full"
        disabled={form.formState.isSubmitting || isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}
