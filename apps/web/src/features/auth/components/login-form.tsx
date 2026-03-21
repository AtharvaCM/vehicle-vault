import { Link } from '@tanstack/react-router';
import { LoginSchema, type LoginInput } from '@vehicle-vault/shared';
import { type Path, useForm } from 'react-hook-form';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LoginFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: LoginInput) => Promise<void> | void;
  submitError?: string | null;
};

export function LoginForm({ isSubmitting = false, onSubmit, submitError }: LoginFormProps) {
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

    await onSubmit(result.data);
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField htmlFor="login-email" label="Email address" error={form.formState.errors.email?.message}>
        <Input
          autoComplete="email"
          id="login-email"
          placeholder="you@example.com"
          {...form.register('email')}
          aria-invalid={Boolean(form.formState.errors.email)}
          type="email"
        />
      </FormField>

      <FormField htmlFor="login-password" label="Password" error={form.formState.errors.password?.message}>
        <Input
          autoComplete="current-password"
          id="login-password"
          placeholder="Enter your password"
          {...form.register('password')}
          aria-invalid={Boolean(form.formState.errors.password)}
          type="password"
        />
      </FormField>

      <div className="flex justify-end">
        <Link className="text-sm font-medium text-slate-700 hover:text-slate-950" to="/forgot-password">
          Forgot password?
        </Link>
      </div>

      {submitError ? <InlineError message={submitError} /> : null}

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
