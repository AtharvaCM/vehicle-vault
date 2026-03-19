import { RegisterSchema, type RegisterInput } from '@vehicle-vault/shared';
import { useForm, type Path } from 'react-hook-form';

import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input autoComplete="name" placeholder="Aarav" {...form.register('name')} />
      </Field>

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
          autoComplete="new-password"
          placeholder="Use at least 8 characters"
          {...form.register('password')}
          type="password"
        />
      </Field>

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
